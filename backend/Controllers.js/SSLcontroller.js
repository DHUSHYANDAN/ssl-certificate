const tls = require("tls");
const net = require("net");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const SSLDetails = require("../models/URLdb");
const Schedule = require("../models/schedule");
require("dotenv").config();

// Function to check expiration and fetch new SSL data if needed
const checkAndFetchSSL = async (req, res) => {
  console.log("Received request body:", req.body); //  Debugging log

  const { url } = req.body;
  if (!url) return res.status(400).json({ message: "URL is required" });

  try {
    const existingData = await SSLDetails.findOne({ url });

    if (existingData) {
      const expiryDate = new Date(existingData.validTo);
      const today = new Date();

      if (expiryDate > today) {
        return res.status(200).json({ message: "Retrieving from stored URL data", data: existingData });
      }
    }

    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;

    const socket = net.connect(443, host, () => {
      const secureSocket = tls.connect(
        { socket, servername: host, rejectUnauthorized: false },
        async () => {
          const certificate = secureSocket.getPeerCertificate();
          if (!certificate || Object.keys(certificate).length === 0) {
            return res.status(400).json({ message: "No SSL certificate found" });
          }


          const lastSSL = await SSLDetails.findOne().sort({ sslId: -1 });
          const newSSLId = lastSSL ? lastSSL.sslId + 1 : 1;

          const sslData = {
            sslId: newSSLId,
            url,
            issuedTo: {
              commonName: certificate.subject?.CN || "Unknown",
              organization: certificate.subject?.O || "Unknown",
            },
            issuedBy: {
              commonName: certificate.issuer?.CN || "Unknown",
              organization: certificate.issuer?.O || "Unknown",
            },
            validFrom: certificate.valid_from,
            validTo: certificate.valid_to,
            siteManager: "",
            email: "",
          };

          await SSLDetails.findOneAndUpdate({ url }, sslData, { upsert: true });

          res.status(200).json({ message: "New SSL data fetched", data: sslData });

          secureSocket.end();
          socket.end();
        }
      );

      secureSocket.on("error", (err) => res.status(500).json({ message: "TLS error", error: err.message }));
    });

    socket.on("error", (err) => {
      console.error("Socket connection error:", err.message);
      return res.status(500).json({ message: "Socketerror", error: err.message });
    });

  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


const storeManagerAndSendMail = async (req, res) => {
  const { url, siteManager, email } = req.body;

  if (!url || !siteManager || !email) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const sslData = await SSLDetails.findOne({ url });
    if (!sslData) {
      return res.status(404).json({ message: "SSL details not found for this URL" });
    }

    sslData.siteManager = siteManager;
    sslData.email = email;
    await sslData.save();


    sendEmailToManager(sslData);

    res.status(200).json({ message: "Manager info saved and email sent", data: sslData });
  } catch (error) {
    res.status(500).json({ message: "Error updating manager info", error: error.message });
  }
};

// Function to send an email
const sendEmailToManager = (sslData) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: sslData.email,
    subject: `SSL Certificate Details for ${sslData.url}`,
    html: `
        <h3>SSL Certificate Details</h3>
        <p><strong>Site:</strong> ${sslData.url}</p>
        <p><strong>Issued To:</strong> ${sslData.issuedTo.commonName} (${sslData.issuedTo.organization})</p>
        <p><strong>Issued By:</strong> ${sslData.issuedBy.commonName} (${sslData.issuedBy.organization})</p>
        <p><strong>Valid From:</strong> ${sslData.validFrom}</p>
        <p><strong>Valid To:</strong> ${sslData.validTo}</p>
        <p><strong>Site Manager:</strong> ${sslData.siteManager}</p>
      `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
};

const getAllSSLDetails = async (req, res) => {
  try {
    const sslDetails = await SSLDetails.find();
    res.status(200).json({ message: "All SSL details retrieved", data: sslDetails });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving SSL details", error: error.message });
  }
};

const updateSSLDetails = async (req, res) => {
  const { url, ...updateData } = req.body;

  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    const updatedSSL = await SSLDetails.findOneAndUpdate({ url: url }, updateData, { new: true });

    if (!updatedSSL) {
      return res.status(404).json({ message: "SSL details not found for this URL" });
    }

    res.status(200).json({ message: "SSL details updated", data: updatedSSL });
  } catch (error) {
    res.status(500).json({ message: "Error updating SSL details", error: error.message });
  }
};



const deleteSSLDetails = async (req, res) => {
  const { sslId } = req.body;

  if (!sslId) {
    return res.status(400).json({ message: "SSL ID is required" });
  }

  try {
    const deletedSSL = await SSLDetails.findOneAndDelete({ sslId: sslId });

    if (!deletedSSL) {
      return res.status(404).json({ message: "SSL details not found for this SSL ID" });
    }

    res.status(200).json({ message: "SSL details deleted", data: deletedSSL });
  } catch (error) {
    res.status(500).json({ message: "Error deleting SSL details", error: error.message });
  }
};

// Cron job to check SSL expiration daily
const sendExpiryAlert = async () => {
  try {
    console.log("Running SSL expiry check...");

    const today = new Date();
    const sslRecords = await SSLDetails.find();

    for (const ssl of sslRecords) {
      try {
        // Fetch fresh SSL details from the socket
        const parsedUrl = new URL(ssl.url);
        const host = parsedUrl.hostname;

        const socket = net.connect(443, host, () => {
          const secureSocket = tls.connect(
            { socket, servername: host, rejectUnauthorized: false },
            async () => {
              const certificate = secureSocket.getPeerCertificate();

              if (!certificate || Object.keys(certificate).length === 0) {
                console.error(`No SSL certificate found for ${ssl.url}`);
                return;
              }

              // Update SSL details in the database
              ssl.issuedTo.commonName = certificate.subject?.CN || "Unknown";
              ssl.issuedTo.organization = certificate.subject?.O || "Unknown";
              ssl.issuedBy.commonName = certificate.issuer?.CN || "Unknown";
              ssl.issuedBy.organization = certificate.issuer?.O || "Unknown";
              ssl.validFrom = certificate.valid_from;
              ssl.validTo = certificate.valid_to;
            
              ssl.siteManager = ssl.siteManager || "";
              ssl.email = ssl.email || "";


              await SSLDetails.findOneAndUpdate({ url: ssl.url }, ssl, { runValidators: false });


              console.log(`Updated SSL details for ${ssl.url}`);

              // Check expiry date
              const expiryDate = new Date(certificate.valid_to);
              const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

              if ([30, 15, 10, 5].includes(daysLeft) || daysLeft <= 5) {
                sendEmailAlert(ssl, daysLeft);
              }

              secureSocket.end();
              socket.end();
            }
          );

          secureSocket.on("error", (err) => console.error(`TLS error for ${ssl.url}:`, err.message));
        });

        socket.on("error", (err) => console.error(`Socket error for ${ssl.url}:`, err.message));

      } catch (err) {
        console.error(`Error updating SSL details for ${ssl.url}:`, err.message);
      }
    }

  } catch (error) {
    console.error("Error checking SSL expirations:", error);
  }
};

// Function to send email
const sendEmailAlert = (ssl, daysLeft) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: ssl.email,
    subject: `Urgent: SSL Certificate Expiry Notification for ${ssl.url}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
        <h2 style="color: #d32f2f;">⚠️ SSL Certificate Expiry Notice</h2>
        
        <p>Dear ${ssl.siteManager},</p>

        <p>We would like to bring to your attention that the SSL certificate for <strong>${ssl.url}</strong> is set to expire soon.</p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Website URL:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ssl.url}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Issued To:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ssl.issuedTo.commonName} (${ssl.issuedTo.organization})</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Issued By:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ssl.issuedBy.commonName} (${ssl.issuedBy.organization})</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Valid From:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ssl.validFrom}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Valid To:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #d32f2f;"><strong>${ssl.validTo} (${daysLeft} days remaining)</strong></td>
          </tr>
        </table>

        <p style="margin-top: 15px;">To avoid any service disruptions, we strongly recommend renewing the SSL certificate at your earliest convenience.</p>

        <p>If you have already initiated the renewal process, please disregard this message.</p>

      

        <p>Best Regards,</p>
        <p><strong>Your IT Security Team</strong></p>
      </div>
    `,
  };

 
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending SSL expiry email:", error);
    } else {
      console.log(`SSL expiry email sent (${daysLeft} days left):`, info.response);
    }
  });
};





let cronJob; // Store the cron job globally

// Function to validate cron format (basic check)
const isValidCron = (expression) => {
  const cronRegex = /^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|[0-2]?\d|3[01]) (\*|[0-9]|1[0-2]) (\*|[0-7])$/;
  return cronRegex.test(expression);
};

// Function to fetch and return cron schedule
const getCronSchedule = async (req, res) => {
  try {
    let scheduleData = await Schedule.findOne({ name: "timeschedule" });

    if (!scheduleData) {
      scheduleData = new Schedule({ name: "timeschedule", cronSchedule: "0 6 * * *" });
      await scheduleData.save();
    }

    return res.status(200).json({
      message: "Cron schedule retrieved successfully",
      name: scheduleData.name,
      cronSchedule: scheduleData.cronSchedule,
    });
  } catch (error) {
    console.error("Error fetching cron schedule:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Function to update cron schedule and restart the job
const updateCronSchedule = async (req, res) => {
  try {
    let { cronSchedule } = req.body;

    if (!cronSchedule || typeof cronSchedule !== "string") {
      return res.status(400).json({ message: "Invalid cron schedule format" });
    }

    cronSchedule = cronSchedule.trim();

    if (!isValidCron(cronSchedule)) {
      return res.status(400).json({ message: "Invalid cron syntax" });
    }

    let scheduleData = await Schedule.findOne({ name: "timeschedule" });

    if (scheduleData) {
      scheduleData.cronSchedule = cronSchedule;
      await scheduleData.save();
    } else {
      scheduleData = new Schedule({ name: "timeschedule", cronSchedule });
      await scheduleData.save();
    }

    // Restart the cron job immediately with the new schedule
    await scheduleCronJob();

    return res.status(200).json({ message: "Cron schedule updated successfully", cronSchedule });
  } catch (error) {
    console.error("Error updating cron schedule:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Function to dynamically schedule cron job
const scheduleCronJob = async () => {
  try {
    if (cronJob) {
      console.log("Stopping previous cron job...");
      cronJob.stop();
    }

    const scheduleData = await Schedule.findOne({ name: "timeschedule" });
    let cronSchedule = scheduleData ? scheduleData.cronSchedule : "0 6 * * *";

    if (!cronSchedule || typeof cronSchedule !== "string") {
      console.error("Invalid cron schedule found in database, using default.");
      cronSchedule = "0 6 * * *";
    }

    cronSchedule = cronSchedule.trim(); // Remove extra spaces

    if (!isValidCron(cronSchedule)) {
      console.error(` Invalid cron schedule: ${cronSchedule}. Using default "0 6 * * *".`);
      cronSchedule = "0 6 * * *";
    }

    console.log(`🔄 Scheduling SSL expiry check with cron time: ${cronSchedule}`);

    // Schedule the new cron job
    cronJob = cron.schedule(cronSchedule, () => {
      console.log("🚀 Running SSL expiry check...");
      sendExpiryAlert();
    });

    cronJob.start(); // Ensure the new job starts
  } catch (error) {
    console.error(" Error scheduling cron job:", error);
  }
};

// Run cron job on startup
scheduleCronJob();


// // Schedule the job to run every day 
// cron.schedule(" 0 6 * * *", () => {
//   console.log("Running SSL expiry check...");

//   sendExpiryAlert();
// });


module.exports = { checkAndFetchSSL, storeManagerAndSendMail, getAllSSLDetails, updateSSLDetails, deleteSSLDetails,updateCronSchedule,getCronSchedule };




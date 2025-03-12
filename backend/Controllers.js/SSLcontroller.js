// SSLcontroller.js
const tls = require("tls");
const net = require("net");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const SSLDetails = require("../models/URLdb");
const Schedule = require("../models/schedule");
const EmailSendLog = require("../models/emailSendLog");
const EmailSchedule = require("../models/emailschedule");
require("dotenv").config();

// Function to check expiration and fetch new SSL data if needed
const checkAndFetchSSL = async (req, res) => {
  console.log("Received request body:", req.body);

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

          // Format dates as proper Date objects
          const validFrom = new Date(certificate.valid_from);
          const validTo = new Date(certificate.valid_to);

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
            validFrom,
            validTo,
            siteManager: "",
            email: "",
          };

          // Create or update the SSL record
          let sslRecord;
          if (existingData) {
            sslRecord = await SSLDetails.findOneAndUpdate(
              { url }, 
              sslData, 
              { new: true, upsert: true }
            );
          } else {
            sslRecord = await SSLDetails.create(sslData);
          }

          // Create email schedule for new records
          if (!existingData) {
            // Calculate notification dates based on expiration
            const emailSchedule = new EmailSchedule({
              sslId: newSSLId,
              nextEmailDates: {
                Normal: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
                thirtyDays: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
                fifteenDays: new Date(validTo.getTime() - (15 * 24 * 60 * 60 * 1000)),
                tenDays: new Date(validTo.getTime() - (10 * 24 * 60 * 60 * 1000)),
                fiveDays: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000)),
                daily: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000))
              },
              ssl: sslRecord._id
            });
            
            await emailSchedule.save();
            
            // Link the email schedule to the SSL record
            sslRecord.emailSchedule = emailSchedule._id;
            await sslRecord.save();
          }

          res.status(200).json({ message: "New SSL data fetched", data: sslRecord });

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

    // Create email schedule if it doesn't exist
    let emailSchedule = await EmailSchedule.findOne({ sslId: sslData.sslId });
    if (!emailSchedule) {
      // Calculate notification dates based on expiration
      const validTo = new Date(sslData.validTo);
      emailSchedule = new EmailSchedule({
        sslId: sslData.sslId,
        nextEmailDates: {
         Normal: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
          thirtyDays: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
          fifteenDays: new Date(validTo.getTime() - (15 * 24 * 60 * 60 * 1000)),
          tenDays: new Date(validTo.getTime() - (10 * 24 * 60 * 60 * 1000)),
          fiveDays: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000)),
          daily: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000))
        },
        emailsSent: { Normal: false },
        ssl: sslData._id
      });
      
      await emailSchedule.save();
      
      // Link the email schedule to the SSL record
      sslData.emailSchedule = emailSchedule._id;
      await sslData.save();
    }

    // Send email notification
 await sendEmailToManager(sslData);
    
      
        // ✅ Force database update to avoid Mongoose tracking issues
    
      

    res.status(200).json({ message: "Manager info saved and email sent", data: sslData });
  } catch (error) {
    res.status(500).json({ message: "Error updating manager info", error: error.message });
  }
};

// Function to send an email
const sendEmailToManager = async (sslData) => {
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
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
        <h2 style="color: #4CAF50;">🔒 SSL Certificate Details</h2>
        <p><strong>Site:</strong> ${sslData.url}</p>
        <p><strong>Issued To:</strong> ${sslData.issuedTo.commonName} (${sslData.issuedTo.organization})</p>
        <p><strong>Issued By:</strong> ${sslData.issuedBy.commonName} (${sslData.issuedBy.organization})</p>
        <p><strong>Valid From:</strong> ${sslData.validFrom}</p>
        <p><strong>Valid To:</strong> ${sslData.validTo}</p>
        <p><strong>Site Manager:</strong> ${sslData.siteManager}</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    
    // Log this email in EmailSendLog
    const emailLog = new EmailSendLog({
      sslId: sslData.sslId,
      emailType: "Normal", // This is an initial notification
      recipient: sslData.email,
      subject: mailOptions.subject,
      status: "success",
      sslDetails: sslData._id
    });
    
    await emailLog.save();
    
    // Add this log to the SSL record's logs array
    if (!sslData.emailLogs) {
      sslData.emailLogs = [];
    }
    
    sslData.emailLogs.push(emailLog._id);
    await sslData.save();
  
    // ✅ **Update the emailsSent.Normal field to true**
    const emailSchedule = await EmailSchedule.findOne({ sslId: sslData.sslId });
    if (emailSchedule) {
      emailSchedule.emailsSent.Normal = true;
      await emailSchedule.save();
    }
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    
    // Log the failed email attempt
    const emailLog = new EmailSendLog({
      sslId: sslData.sslId,
      emailType: "Normal", // This is an initial notification
      recipient: sslData.email,
      subject: mailOptions.subject,
      status: "failed",
      statusMessage: error.message,
      sslDetails: sslData._id
    });
    
    await emailLog.save();
    
    // Add this log to the SSL record's logs array
    if (!sslData.emailLogs) {
      sslData.emailLogs = [];
    }
    
    sslData.emailLogs.push(emailLog._id);
    await sslData.save();
    
    return false;
  }
};

const getAllSSLDetails = async (req, res) => {
  try {
    // Get SSL details with related email schedules and logs
    const sslDetails = await SSLDetails.find()
      .populate('emailSchedule')
      .populate({
        path: 'emailLogs',
        options: { sort: { 'sentAt': -1 }, limit: 5 } // Most recent 5 emails
      });
      
    // Calculate days until expiration for each record
    const detailsWithExpiry = sslDetails.map(ssl => {
      const daysRemaining = ssl.daysUntilExpiration();
      
      // Determine notification status
      const notificationStatus = {
       NormalSent: ssl.emailSchedule?.emailsSent?.Normal || false,
        thirtyDaysSent: ssl.emailSchedule?.emailsSent?.thirtyDays || false,
        fifteenDaysSent: ssl.emailSchedule?.emailsSent?.fifteenDays || false,
        tenDaysSent: ssl.emailSchedule?.emailsSent?.tenDays || false,
        fiveDaysSent: ssl.emailSchedule?.emailsSent?.fiveDays || false,
        dailyEmailCount: ssl.emailSchedule?.emailsSent?.dailySentCount || 0
      };
      
      return {
        ...ssl.toObject(),
        daysRemaining,
        notificationStatus
      };
    });
    
    res.status(200).json({ 
      message: "All SSL details retrieved", 
      data: detailsWithExpiry 
    });
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
    const updatedSSL = await SSLDetails.findOneAndUpdate({ url }, updateData, { new: true });
    if (!updatedSSL) {
      return res.status(404).json({ message: "SSL details not found for this URL" });
    }
    
    // If validTo date changed, update the email schedule
    if (updateData.validTo) {
      const emailSchedule = await EmailSchedule.findOne({ sslId: updatedSSL.sslId });
      if (emailSchedule) {
        const validTo = new Date(updateData.validTo);
        
        // Update notification dates
        emailSchedule.nextEmailDates = {
          Normal: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
          thirtyDays: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
          fifteenDays: new Date(validTo.getTime() - (15 * 24 * 60 * 60 * 1000)),
          tenDays: new Date(validTo.getTime() - (10 * 24 * 60 * 60 * 1000)),
          fiveDays: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000)),
          daily: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000))
        };
        
        // Reset notification status since certificate has been renewed
        emailSchedule.emailsSent = {
          Normal: false,
          thirtyDays: false,
          fifteenDays: false,
          tenDays: false,
          fiveDays: false,
          dailySentCount: 0
        };
        
        await emailSchedule.save();
      }
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
    // Find the SSL record
    const sslRecord = await SSLDetails.findOne({ sslId });

    if (!sslRecord) {
      return res.status(404).json({ message: "SSL details not found for this SSL ID" });
    }

    // Try deleting related email logs
    try {
      if (sslRecord.emailLogs && sslRecord.emailLogs.length > 0) {
        await EmailSendLog.deleteMany({ _id: { $in: sslRecord.emailLogs } });
      }
    } catch (err) {
      console.error("Error deleting email logs:", err.message);
      return res.status(500).json({ message: "Failed to delete email logs", error: err.message });
    }

    // Try deleting the email schedule
    try {
      if (sslRecord.emailSchedule) {
        await EmailSchedule.findByIdAndDelete(sslRecord.emailSchedule);
      }
    } catch (err) {
      console.error("Error deleting email schedule:", err.message);
      return res.status(500).json({ message: "Failed to delete email schedule", error: err.message });
    }

    // Delete SSL record
    const deletedSSL = await SSLDetails.findOneAndDelete({ sslId });

    res.status(200).json({ message: "SSL details and related records deleted successfully", data: deletedSSL });
  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({ message: "An error occurred while deleting SSL details", error: error.message });
  }
};


// Function to send expiry alerts
const sendExpiryAlert = async () => {
  try {
    console.log("Running SSL expiry check...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Find all certificates where notifications should be sent today
    const schedulesNeeded = await EmailSchedule.find({
      $or: [
        { "nextEmailDates.thirtyDays": { $gte: today, $lt: tomorrow }, "emailsSent.thirtyDays": false },
        { "nextEmailDates.fifteenDays": { $gte: today, $lt: tomorrow }, "emailsSent.fifteenDays": false },
        { "nextEmailDates.tenDays": { $gte: today, $lt: tomorrow }, "emailsSent.tenDays": false },
        { "nextEmailDates.fiveDays": { $gte: today, $lt: tomorrow }, "emailsSent.fiveDays": false },
        // For daily emails, we check if we're within 5 days of expiry
        { "nextEmailDates.daily": { $lt: tomorrow } }
      ],
      notificationsEnabled: true
    }).populate('ssl');
    
    for (const schedule of schedulesNeeded) {
      try {
        if (!schedule.ssl) {
          console.log(`No SSL record found for schedule with ID ${schedule._id}`);
          continue;
        }
        
        const ssl = schedule.ssl;
        const daysLeft = ssl.daysUntilExpiration();
        
        // Check which notifications need to be sent
        if (daysLeft <= 30 && daysLeft > 15 && !schedule.emailsSent.thirtyDays) {
          await sendEmailAlert(ssl, daysLeft, "30days");
          schedule.emailsSent.thirtyDays = true;
        }
        
        if (daysLeft <= 15 && daysLeft > 10 && !schedule.emailsSent.fifteenDays) {
          await sendEmailAlert(ssl, daysLeft, "15days");
          schedule.emailsSent.fifteenDays = true;
        }
        
        if (daysLeft <= 10 && daysLeft > 5 && !schedule.emailsSent.tenDays) {
          await sendEmailAlert(ssl, daysLeft, "10days");
          schedule.emailsSent.tenDays = true;
        }
        
        if (daysLeft <= 5 && daysLeft > 0 && !schedule.emailsSent.fiveDays) {
          await sendEmailAlert(ssl, daysLeft, "5days");
          schedule.emailsSent.fiveDays = true;
        }
        
        // If we're in the last 5 days, send daily emails
        if (daysLeft <= 5 && daysLeft > 0) {
          await sendEmailAlert(ssl, daysLeft, "daily");
          schedule.emailsSent.dailySentCount += 1;
        }
        
        await schedule.save();
      } catch (err) {
        console.error(`Error processing schedule ${schedule._id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("Error running expiry check:", error);
  }
};

// Function to send email alerts and log them
const sendEmailAlert = async (ssl, daysLeft, emailType) => {
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

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`SSL expiry email sent (${daysLeft} days left, type: ${emailType}):`, info.response);
    
    // Log this email in EmailSendLog
    const emailLog = new EmailSendLog({
      sslId: ssl.sslId,
      emailType,
      recipient: ssl.email,
      subject: mailOptions.subject,
      status: "success",
      sslDetails: ssl._id
    });
    
    await emailLog.save();
    
    // Add this log to the SSL record's logs array
    if (!ssl.emailLogs) {
      ssl.emailLogs = [];
    }
    
    ssl.emailLogs.push(emailLog._id);
    await ssl.save();
    
    return true;
  } catch (error) {
    console.error("Error sending SSL expiry email:", error);
    
    // Log the failed email attempt
    const emailLog = new EmailSendLog({
      sslId: ssl.sslId,
      emailType,
      recipient: ssl.email,
      subject: mailOptions.subject,
      status: "failed",
      statusMessage: error.message,
      sslDetails: ssl._id
    });
    
    await emailLog.save();
    
    // Add this log to the SSL record's logs array
    if (!ssl.emailLogs) {
      ssl.emailLogs = [];
    }
    
    ssl.emailLogs.push(emailLog._id);
    await ssl.save();
    
    return false;
  }
};

let cronJob; // Store the cron job globally

// Function to validate cron format
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

    cronSchedule = cronSchedule.trim();

    if (!isValidCron(cronSchedule)) {
      console.error(`Invalid cron schedule: ${cronSchedule}. Using default "0 6 * * *".`);
      cronSchedule = "0 6 * * *";
    }
    cronJob = cron.schedule(cronSchedule, async () => {
          console.log(`Fetching all stored SSL details from the websites...`);

          const sslDetails = await SSLDetails.find();

          for (const ssl of sslDetails) {
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

              const validFrom = new Date(certificate.valid_from);
              const validTo = new Date(certificate.valid_to);

              const sslData = {
                issuedTo: {
                commonName: certificate.subject?.CN || "Unknown",
                organization: certificate.subject?.O || "Unknown",
                },
                issuedBy: {
                commonName: certificate.issuer?.CN || "Unknown",
                organization: certificate.issuer?.O || "Unknown",
                },
                validFrom,
                validTo,
              };

              await SSLDetails.findOneAndUpdate(
                { url: ssl.url },
                sslData,
                { new: true, upsert: true }
              );

              console.log(`Updated SSL details for ${ssl.url}`);

              secureSocket.end();
              socket.end();
              }
            );

            secureSocket.on("error", (err) => console.error(`TLS error for ${ssl.url}:`, err.message));
            });

            socket.on("error", (err) => console.error(`Socket connection error for ${ssl.url}:`, err.message));
          }
    console.log(`🔄 Scheduling SSL expiry check with cron time: ${cronSchedule}`);

   
      console.log("🚀 Running SSL expiry check...");

      try {
        // Fetch latest SSL details from the database
        const sslDetails = await SSLDetails.find();
        
        for (const ssl of sslDetails) {
          const daysRemaining = ssl.daysUntilExpiration();
          const emailSchedule = await EmailSchedule.findOne({ sslId: ssl.sslId });

          if (emailSchedule) {
            if (daysRemaining <= 30 && !emailSchedule.emailsSent.thirtyDays) {
              await sendEmailAlert(ssl, daysRemaining, "30days");
              emailSchedule.emailsSent.thirtyDays = true;
            }
            if (daysRemaining <= 15 && !emailSchedule.emailsSent.fifteenDays) {
              await sendEmailAlert(ssl, daysRemaining, "15days");
              emailSchedule.emailsSent.fifteenDays = true;
            }
            if (daysRemaining <= 10 && !emailSchedule.emailsSent.tenDays) {
              await sendEmailAlert(ssl, daysRemaining, "10days");
              emailSchedule.emailsSent.tenDays = true;
            }
            if (daysRemaining <= 5 && !emailSchedule.emailsSent.fiveDays) {
              await sendEmailAlert(ssl, daysRemaining, "5days");
              emailSchedule.emailsSent.fiveDays = true;
            }
            if (daysRemaining <= 8) {
              await sendEmailAlert(ssl, daysRemaining, "daily");
              emailSchedule.emailsSent.dailySentCount += 1;
            }
            
            await emailSchedule.save();
          }
        }
        
        console.log("✅ SSL expiry check completed.");
      } catch (error) {
        console.error("Error during SSL expiry check:", error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"  // Force the correct timezone
    });

    cronJob.start();
  } catch (error) {
    console.error("Error scheduling cron job:", error);
  }
};



// Get details for a single SSL certificate including notification history
// const getSSLDetail = async (req, res) => {
//   const { sslId } = req.params;
  
//   if (!sslId) {
//     return res.status(400).json({ message: "SSL ID is required" });
//   }
  
//   try {
//     const ssl = await SSLDetails.findOne({ sslId })
//       .populate('emailSchedule')
//       .populate({
//         path: 'emailLogs',
//         options: { sort: { 'sentAt': -1 } }
//       });
    
//     if (!ssl) {
//       return res.status(404).json({ message: "SSL certificate not found" });
//     }
    
//     // Calculate days remaining
//     const daysRemaining = ssl.daysUntilExpiration();
    
//     // Get notification status
//     const notificationStatus = {
//       NormalSent: ssl.emailSchedule?.emailsSent.Normal || false,
//       thirtyDaysSent: ssl.emailSchedule?.emailsSent.thirtyDays || false,
//       fifteenDaysSent: ssl.emailSchedule?.emailsSent.fifteenDays || false,
//       tenDaysSent: ssl.emailSchedule?.emailsSent.tenDays || false,
//       fiveDaysSent: ssl.emailSchedule?.emailsSent.fiveDays || false,
//       dailyEmailCount: ssl.emailSchedule?.emailsSent.dailySentCount || 0
//     };
//     // Organize email logs by emailType
//     const emailSentDates = {};
//     ssl.emailLogs.forEach(log => {
//       if (!emailSentDates[log.emailType]) {
//         emailSentDates[log.emailType] = log.sentAt;
//       }
//     });
//     res.status(200).json({
//       message: "SSL details retrieved",
//       data: {
//         sslDetails: ssl,
//         daysRemaining,
//         notificationStatus,
//         emailHistory: ssl.emailLogs,
//         emailSentDates
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Error retrieving SSL details", error: error.message });
//   }
// };

// Run cron job on startup
scheduleCronJob();

module.exports = { 
  checkAndFetchSSL, 
  storeManagerAndSendMail, 
  getAllSSLDetails, 
  updateSSLDetails, 
  deleteSSLDetails,
  updateCronSchedule,
  getCronSchedule,
  // getSSLDetail
};
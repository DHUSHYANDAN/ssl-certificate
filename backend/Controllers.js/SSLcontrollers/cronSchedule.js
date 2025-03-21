// SSLcontroller.js
const tls = require("tls");
const net = require("net");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const SSLDetails = require("../../models/URLdb");
const Schedule = require("../../models/schedule");
const EmailSendLog = require("../../models/emailSendLog");

const EmailSchedule = require("../../models/emailschedule");
require("dotenv").config();



let cronJob; // Store the cron job globally

// Function to validate cron format
const isValidCron = (expression) => {
  const cronRegex = /^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|[0-2]?\d|3[01]) (\*|[0-9]|1[0-2]) (\*|[0-7])$/;
  return cronRegex.test(expression);
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
  
      // Set all existing schedules to inactive
      await Schedule.updateMany({}, { active: false });
  
      // Find or create the schedule and set active to true
      let scheduleData = await Schedule.findOne({ cronSchedule });
  
      if (scheduleData) {
        scheduleData.active = true;
        scheduleData.cronSchedule = cronSchedule;
        await scheduleData.save();
      } else {
        scheduleData = new Schedule({ cronSchedule, active: true });
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
  

// Function to fetch and return cron schedule
const getCronSchedule = async (req, res) => {
  try {
    let scheduleData = await Schedule.findOne({ active: true });

    if (!scheduleData) {
      scheduleData = new Schedule({  cronSchedule: "0 6 * * *" });
      await scheduleData.save();
    }

    return res.status(200).json({
      message: "Cron schedule retrieved successfully",
     
      cronSchedule: scheduleData.cronSchedule,
    });
  } catch (error) {
    console.error("Error fetching cron schedule:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

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

const scheduleCronJob = async () => {
 

    try {
      if (cronJob) {
        console.log("Stopping previous cron job...");
        cronJob.stop();
      }
  
      const scheduleData = await Schedule.findOne({ active: true });

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
              if (daysRemaining <= 5) {
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
  scheduleCronJob();

module.exports = {  updateCronSchedule, getCronSchedule };
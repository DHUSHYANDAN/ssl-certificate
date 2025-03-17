const tls = require("tls");
const net = require("net");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { SSLDetails, EmailSendLog, EmailSchedule } = require("../../models/associations");
const  Schedule  = require("../../models/schedule");
require("dotenv").config();

let cronJob;

const isValidCron = (expression) => {
  const cronRegex = /^([0-5]?\d|\*) ([01]?\d|2[0-3]|\*) ([0-2]?\d|3[01]|\*) ([0-9]|1[0-2]|\*) ([0-7]|\*)$/;
  return cronRegex.test(expression);
};

const updateCronSchedule = async (req, res) => {
  try {
    let { cronSchedule } = req.body;

    if (!cronSchedule || typeof cronSchedule !== "string" || !isValidCron(cronSchedule.trim())) {
      return res.status(400).json({ message: "Invalid cron schedule format" });
    }

    await Schedule.update({ active: false }, { where: {} });
    let [scheduleData, created] = await Schedule.findOrCreate({ where: { cronSchedule }, defaults: { active: true } });
    if (!created) await scheduleData.update({ active: true });

    await scheduleCronJob();
    return res.status(200).json({ message: "Cron schedule updated successfully", cronSchedule });
  } catch (error) {
    console.error("Error updating cron schedule:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getCronSchedule = async (req, res) => {
  try {
    let scheduleData = await Schedule.findOne({ where: { active: true } });
    if (!scheduleData) {
      scheduleData = await Schedule.create({ cronSchedule: "0 6 * * *", active: true });
    }
    return res.status(200).json({ message: "Cron schedule retrieved successfully", cronSchedule: scheduleData.cronSchedule });
  } catch (error) {
    console.error("Error fetching cron schedule:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const sendEmailAlert = async (ssl, daysLeft, emailType) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
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
    await transporter.sendMail(mailOptions);
    await EmailSendLog.create({ sslId: ssl.id, emailType, recipient: ssl.email, status: "success" });
    return true;
  } catch (error) {
    await EmailSendLog.create({ sslId: ssl.id, emailType, recipient: ssl.email, status: "failed", statusMessage: error.message });
    return false;
  }
};

const scheduleCronJob = async () => {
  try {
    if (cronJob) cronJob.stop();
    const scheduleData = await Schedule.findOne({ where: { active: true } });
    let cronSchedule = scheduleData ? scheduleData.cronSchedule : "0 6 * * *";

    cronJob = cron.schedule(cronSchedule, async () => {
      console.log(`Fetching all stored SSL details...`);
      const sslDetails = await SSLDetails.findAll();

      for (const ssl of sslDetails) {
        try {
          const parsedUrl = new URL(ssl.url);
          const host = parsedUrl.hostname;
          const socket = net.connect(443, host, () => {
            const secureSocket = tls.connect(
              { socket, servername: host, rejectUnauthorized: false },
              async () => {
                const certificate = secureSocket.getPeerCertificate();
                if (!certificate || Object.keys(certificate).length === 0) return;

                await SSLDetails.update({
                  issuedTo: certificate.subject?.CN || "Unknown",
                  issuedBy: certificate.issuer?.CN || "Unknown",
                  validFrom: certificate.valid_from,
                  validTo: certificate.valid_to,
                }, { where: { url: ssl.url } });

                secureSocket.end();
                socket.end();
              }
            );
            secureSocket.on("error", (err) => console.error(`TLS error for ${ssl.url}:`, err.message));
          });
          socket.on("error", (err) => console.error(`Socket connection error for ${ssl.url}:`, err.message));
        } catch (error) {
          console.error(`Error updating SSL details for ${ssl.url}:`, error.message);
        }
      }

      console.log("Running SSL expiry check...");
      const sslDetailsList = await SSLDetails.findAll();
      
      for (const ssl of sslDetailsList) {
        const validToDate = new Date(ssl.validTo);
        if (isNaN(validToDate.getTime())) {
          console.error(`Invalid date format for ${ssl.url}: ${ssl.validTo}`);
          continue; // Skip if date is invalid
        }
      
        const daysRemaining = Math.floor((validToDate - new Date()) / (1000 * 60 * 60 * 24));
        console.log(`Checking SSL expiry for ${ssl.url}: ${daysRemaining} days remaining`);
      
        const emailSchedule = await EmailSchedule.findOne({ where: { sslId: ssl.sslId } });
        
        if (!emailSchedule) {
          console.log(`No email schedule found for ${ssl.url}, skipping...`);
          continue;
        }
      
        if (daysRemaining <= 30 && !emailSchedule.emailsSent.thirtyDays) {
          console.log(`✅ Triggering 30-day email for ${ssl.url}`);
          await sendEmailAlert(ssl, daysRemaining, "30days");
          emailSchedule.emailsSent.thirtyDays = true;
        }
        if (daysRemaining <= 15 && !emailSchedule.emailsSent.fifteenDays) {
          console.log(`✅ Triggering 15-day email for ${ssl.url}`);
          await sendEmailAlert(ssl, daysRemaining, "15days");
          emailSchedule.emailsSent.fifteenDays = true;
        }
        if (daysRemaining <= 10 && !emailSchedule.emailsSent.tenDays) {
          console.log(`✅ Triggering 10-day email for ${ssl.url}`);
          await sendEmailAlert(ssl, daysRemaining, "10days");
          emailSchedule.emailsSent.tenDays = true;
        }
        if (daysRemaining <= 5 && !emailSchedule.emailsSent.fiveDays) {
          console.log(`✅ Triggering 5-day email for ${ssl.url}`);
          await sendEmailAlert(ssl, daysRemaining, "5days");
          emailSchedule.emailsSent.fiveDays = true;
        }
        if (daysRemaining <= 5) {
          console.log(`✅ Triggering daily email for ${ssl.url}`);
          await sendEmailAlert(ssl, daysRemaining, "daily");
          emailSchedule.emailsSent.dailySentCount += 1;
        }
      
        await emailSchedule.save();
      }
      
      console.log("SSL expiry check completed.");
      
      
    }, { scheduled: true, timezone: "Asia/Kolkata" });

    cronJob.start();
  } catch (error) {
    console.error("Error scheduling cron job:", error);
  }
};

scheduleCronJob();

module.exports = { updateCronSchedule, getCronSchedule };

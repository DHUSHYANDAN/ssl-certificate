
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { SSLDetails, EmailSendLog, EmailSchedule } = require("../../../models/associations");
const Schedule = require("../../../models/schedule");
require("dotenv").config();
const { Worker } = require("worker_threads");
const path = require("path");
const pLimit = require('p-limit');


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
  console.log("Sending email alert for", ssl.url,emailType);

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
  
          <p>We would like to bring to your attention that the SSL certificate for <strong>${ssl.url}</strong> is set to expire soon or has already expired.</p>
  
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Website URL:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${ssl.url}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Issued To:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${ssl.issuedToCommonName} (${ssl.issuedToOrganization})</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Issued By:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${ssl.issuedByCommonName} (${ssl.issuedByOrganization})</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Valid From:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${ssl.validFrom}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Valid To:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #d32f2f;">
    <strong>${ssl.validTo} (${daysLeft < 0 ? "Expired" : `${daysLeft} days remaining`})</strong>
</td>

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
    await EmailSendLog.create({ sslId: ssl.sslId, emailType, subject:`Urgent: SSL Certificate Expiry Notification for ${ssl.url}`, recipient: ssl.email, status: "success" });
    return true;
  } catch (error) {
    await EmailSendLog.create({ sslId: ssl.sslId, emailType, recipient: ssl.email||'Not Entered', subject: `Urgent: SSL Certificate Expiry Notification for ${ssl.url}`, status: "failed", statusMessage: error.message });
     deleteEmailLog(ssl.sslId);
    return false;
  }
};

//here delete the emaillog that is failure . when there is failure email log to 10 remove the failure email log previous email logs
const deleteEmailLog = async (sslId) => {
  try {
    const emailLogs = await EmailSendLog.findAll({ where: { sslId, status: "failed" } });
    if (emailLogs.length > 10) {
      const logsToDelete = emailLogs.slice(0, emailLogs.length - 10);
      await Promise.all(logsToDelete.map(log => log.destroy()));
      console.log(`Deleted ${logsToDelete.length} old email logs for SSL ID: ${sslId}`);
    }
  } catch (error) {
    console.error(`Error deleting email logs for SSL ID ${sslId}:`, error);
  }
};


const scheduleCronJob = async () => {
  
  try {
    if (cronJob) {
      console.log("Stopping previous cron job...");
      cronJob.stop();
    }

    const scheduleData = await Schedule.findOne({ where: { active: true } });
    let cronSchedule = scheduleData ? scheduleData.cronSchedule : "0 6 * * *";

    if (!cronSchedule || typeof cronSchedule !== "string") {
      console.error("Invalid cron schedule found in database, using default.");
      cronSchedule = "0 6 * * *";
    }

    cronSchedule = cronSchedule.trim();

    cronJob = cron.schedule(cronSchedule, async () => {
      const startTime = Date.now(); // ⏱️ Start time
      console.log(`🚀 Fetching all stored SSL details... using multithreading`);
      const sslDetails = await SSLDetails.findAll();

      const limit = pLimit(15); // Max 5 workers at a time

      const checkPromises = sslDetails.map((ssl) =>
        limit(() =>
          new Promise((resolve) => {
            const worker = new Worker(path.resolve(__dirname, "sslCheckerWorker.js"), {
              workerData: { url: ssl.url }
            });
      
            worker.on("message", async (msg) => {
              if (msg.success) {
                const cert = msg.data;
                await SSLDetails.upsert({
                  url: cert.url,
                  issuedToCommonName: cert.issuedToCommonName,
                  issuedToOrganization: cert.issuedToOrganization,
                  issuedByCommonName: cert.issuedByCommonName,
                  issuedByOrganization: cert.issuedByOrganization,
                  validFrom: cert.validFrom,
                  validTo: cert.validTo,
                }, {
                  where: { url: cert.url }
                });
      
                console.log(`✅ Updated SSL details for ${cert.url}`);
              } else {
                console.error(`❌ SSL check failed for ${ssl.url}: ${msg.error}`);
              }
              resolve(); // Finish the promise
            });
      
            worker.on("error", (err) => {
              console.error(`❌ Worker error for ${ssl.url}:`, err.message);
              resolve(); // Prevent hanging
            });
      
            worker.on("exit", (code) => {
              if (code !== 0) {
                console.error(`⚠️ Worker stopped with exit code ${code}`);
              }
            });
          })
        )
      );
      
      await Promise.all(checkPromises);

      console.log(`🔄 Running SSL expiry check with cron time: ${cronSchedule}`);
      console.log(`Fetched ${sslDetails.length} SSL details.`);
     console.log("🚀 Running SSL expiry check...");

      try {
        const sslDetails = await SSLDetails.findAll();
        const emailLimit = pLimit(15); // Max 10 parallel email sends
        const emailTasks = sslDetails.map((ssl) => 
          emailLimit(async () => {
            try {
              const daysRemaining = Math.ceil((ssl.validTo - new Date()) / (24 * 60 * 60 * 1000));
              const emailSchedule = await EmailSchedule.findOne({ where: { sslId: ssl.sslId } });
        
              if (emailSchedule) {
                let emailsSent = emailSchedule.emailsSent ? JSON.parse(emailSchedule.emailsSent) : {};
        
                if (daysRemaining <= 31 && !emailsSent.thirtyDays) {
                  emailsSent.thirtyDays = await sendEmailAlert(ssl, daysRemaining, "30days") || false;
                }
        
                if (daysRemaining <= 15 && !emailsSent.fifteenDays) {
                  emailsSent.fifteenDays = await sendEmailAlert(ssl, daysRemaining, "15days") || false;
                }
        
                if (daysRemaining <= 10 && !emailsSent.tenDays) {
                  emailsSent.tenDays = await sendEmailAlert(ssl, daysRemaining, "10days") || false;
                }
        
                if (daysRemaining <= 5 && !emailsSent.fiveDays) {
                  emailsSent.fiveDays = await sendEmailAlert(ssl, daysRemaining, "5days") || false;
                }
        
                if (daysRemaining <= 5) {
                  if (!emailsSent.dailyEmailCount) {
                    emailsSent.dailyEmailCount = 0;
                  }
        
                  const emailSent = await sendEmailAlert(ssl, daysRemaining, "daily");
                  if (emailSent) {
                    emailsSent.dailyEmailCount += 1;
                  }
                }
        
                await EmailSchedule.update(
                  { emailsSent: JSON.stringify(emailsSent) },
                  { where: { sslId: ssl.sslId } }
                );
              }
            } catch (e) {
              console.error(`❌ Error processing ${ssl.url}:`, e.message);
            }
          })
        );
        
        await Promise.all(emailTasks); 
        
        console.log("✅ SSL expiry check completed.");
                                                                                   
      } catch (error) {
        console.error("Error during SSL expiry check:", error);
      }
      const endTime = Date.now(); // ⏱️ End time
      const executionTimeInSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`⏳ SSL job executed in ${executionTimeInSeconds} seconds`);
    
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    cronJob.start();
  } catch (error) {
    console.error("Error scheduling cron job:", error);
  }
  
};

scheduleCronJob();



module.exports = { updateCronSchedule, getCronSchedule };

  
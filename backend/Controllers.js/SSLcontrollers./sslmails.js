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


// Function to send expiry alerts
// const sendExpiryAlert = async () => {
//     try {
//       console.log("Running SSL expiry check...");
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
      
//       const tomorrow = new Date(today);
//       tomorrow.setDate(tomorrow.getDate() + 1);
      
//       // Find all certificates where notifications should be sent today
//       const schedulesNeeded = await EmailSchedule.find({
//         $or: [
//           { "nextEmailDates.thirtyDays": { $gte: today, $lt: tomorrow }, "emailsSent.thirtyDays": false },
//           { "nextEmailDates.fifteenDays": { $gte: today, $lt: tomorrow }, "emailsSent.fifteenDays": false },
//           { "nextEmailDates.tenDays": { $gte: today, $lt: tomorrow }, "emailsSent.tenDays": false },
//           { "nextEmailDates.fiveDays": { $gte: today, $lt: tomorrow }, "emailsSent.fiveDays": false },
//           // For daily emails, we check if we're within 5 days of expiry
//           { "nextEmailDates.daily": { $lt: tomorrow } }
//         ],
//         notificationsEnabled: true
//       }).populate('ssl');
      
//       for (const schedule of schedulesNeeded) {
//         try {
//           if (!schedule.ssl) {
//             console.log(`No SSL record found for schedule with ID ${schedule._id}`);
//             continue;
//           }
          
//           const ssl = schedule.ssl;
//           const daysLeft = ssl.daysUntilExpiration();
          
//           // Check which notifications need to be sent
//           if (daysLeft <= 30 && daysLeft > 15 && !schedule.emailsSent.thirtyDays) {
//             await sendEmailAlert(ssl, daysLeft, "30days");
//             schedule.emailsSent.thirtyDays = true;
//           }
          
//           if (daysLeft <= 15 && daysLeft > 10 && !schedule.emailsSent.fifteenDays) {
//             await sendEmailAlert(ssl, daysLeft, "15days");
//             schedule.emailsSent.fifteenDays = true;
//           }
          
//           if (daysLeft <= 10 && daysLeft > 5 && !schedule.emailsSent.tenDays) {
//             await sendEmailAlert(ssl, daysLeft, "10days");
//             schedule.emailsSent.tenDays = true;
//           }
          
//           if (daysLeft <= 5 && daysLeft > 0 && !schedule.emailsSent.fiveDays) {
//             await sendEmailAlert(ssl, daysLeft, "5days");
//             schedule.emailsSent.fiveDays = true;
//           }
          
//           // If we're in the last 5 days, send daily emails
//           if (daysLeft <= 5 && daysLeft > 0) {
//             await sendEmailAlert(ssl, daysLeft, "daily");
//             schedule.emailsSent.dailySentCount += 1;
//           }
          
//           await schedule.save();
//         } catch (err) {
//           console.error(`Error processing schedule ${schedule._id}:`, err.message);
//         }
//       }
//     } catch (error) {
//       console.error("Error running expiry check:", error);
//     }
//   };
  
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


module.exports = { storeManagerAndSendMail ,sendEmailAlert};
// SSLcontroller.js
const nodemailer = require("nodemailer");
const { SSLDetails, EmailSendLog, EmailSchedule } = require("../../models/associations");
require("dotenv").config();

const storeManagerAndSendMail = async (req, res) => {
  const { url, siteManager, email } = req.body;

  if (!url || !siteManager || !email) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Find SSL record
    const sslData = await SSLDetails.findOne({ where: { url } });
    if (!sslData) {
      return res.status(404).json({ message: "SSL details not found for this URL" });
    }

    // Update manager details
    sslData.siteManager = siteManager;
    sslData.email = email;
    await sslData.save();

    // Find existing email schedule or create one
    let emailSchedule = await EmailSchedule.findOne({ where: { sslId: sslData.sslId } });

    if (!emailSchedule) {
      const validTo = new Date(sslData.validTo);

      emailSchedule = await EmailSchedule.create({
        sslId: sslData.sslId,
        nextEmailDates: {
          Normal: new Date(validTo.getTime() - 30 * 24 * 60 * 60 * 1000),
          thirtyDays: new Date(validTo.getTime() - 30 * 24 * 60 * 60 * 1000),
          fifteenDays: new Date(validTo.getTime() - 15 * 24 * 60 * 60 * 1000),
          tenDays: new Date(validTo.getTime() - 10 * 24 * 60 * 60 * 1000),
          fiveDays: new Date(validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
          daily: new Date(validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
        emailsSent: {
          Normal: false,
          thirtyDays: false,
          fifteenDays: false,
          tenDays: false,
          fiveDays: false,
          dailySentCount: 0,
        },
      });
    }

    // Send email
    const emailSent = await sendEmailToManager(sslData);
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send email" });
    }

    res.status(200).json({ message: "Manager info saved and email sent", data: sslData });
  } catch (error) {
    console.error("Error in storeManagerAndSendMail:", error);
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
        <p><strong>Issued To:</strong> ${sslData.issuedToCommonName} (${sslData.issuedToOrganization})</p>
        <p><strong>Issued By:</strong> ${sslData.issuedByCommonName} (${sslData.issuedByOrganization})</p>
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
    const emailLog = await EmailSendLog.create({
      sslId: sslData.sslId,
      emailType: "Normal", // This is an initial notification
      recipient: sslData.email,
      subject: mailOptions.subject,
      status: "success",
      sslDetails: sslData.sslId,
     
    });

    // Add this log to the SSL record's logs array
    sslData.emailLogs = sslData.emailLogs || [];
    sslData.emailLogs.push(emailLog.id);
    await sslData.save();

    const emailSchedule = await EmailSchedule.findOne({ where: { sslId: sslData.sslId } });

    if (emailSchedule) {
      // Ensure emailsSent is always an object
      let emailsSent = emailSchedule.emailsSent ? JSON.parse(emailSchedule.emailsSent) : {};
      console.log("emailsSent:", emailsSent);
      
      // Update the NormalSent flag
      emailsSent.Normal = true;
    
      // Save the updated object as a string
      emailSchedule.emailsSent = JSON.stringify(emailsSent);
      
      // Save changes to the database
      await emailSchedule.save();
      console.log("✅ Successfully updated emailsSent:", emailSchedule.emailsSent);
    } else {
      console.warn("⚠️ No emailSchedule found for sslId:", sslData.sslId);
    }
    
    
    
    return true;
  } catch (error) {
    console.error("Error sending email:", error);

    // Log the failed email attempt
    const emailLog = await EmailSendLog.create({
      sslId: sslData.sslId,
      emailType: "Normal", // This is an initial notification
      recipient: sslData.email,
      subject: mailOptions.subject,
      status: "failed",
      statusMessage: error.message,
      sslDetails: sslData.id,
    });

    // Add this log to the SSL record's logs array
    sslData.emailLogs = sslData.emailLogs || [];
    sslData.emailLogs.push(emailLog.id);
    await sslData.save();

    return false;
  }
};

module.exports = { storeManagerAndSendMail };

const { parentPort } = require("worker_threads");
const { SSLDetails, EmailSchedule, EmailSendLog } = require("../../../models/associations");
const Schedule = require("../../../models/schedule");
const tls = require("tls");
const net = require("net");
require("dotenv").config();
const nodemailer = require("nodemailer");

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

const sendEmailAlert = async (ssl, daysLeft, emailType) => {
    console.log("Sending email alert for", ssl.url);

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
        await EmailSendLog.create({ sslId: ssl.sslId, emailType, subject: `Urgent: SSL Certificate Expiry Notification for ${ssl.url}`, recipient: ssl.email, status: "success" });
        return true;
    } catch (error) {
        await EmailSendLog.create({ sslId: ssl.sslId, emailType, recipient: ssl.email || 'Not Entered', subject: `Urgent: SSL Certificate Expiry Notification for ${ssl.url}`, status: "failed", statusMessage: error.message });
        deleteEmailLog(ssl.sslId);
        return false;
    }
};

(async () => {
    try {
        const sslDetails = await SSLDetails.findAll();
        for (const ssl of sslDetails) {
            const parsedUrl = new URL(ssl.url);
            const host = parsedUrl.hostname;
            const socket = net.connect(443, host, () => {
                const secureSocket = tls.connect(
                    { socket, servername: host, rejectUnauthorized: false },
                    async () => {
                        const certificate = secureSocket.getPeerCertificate();
                        if (!certificate || Object.keys(certificate).length === 0) return;

                        const validFrom = new Date(certificate.valid_from);
                        const validTo = new Date(certificate.valid_to);

                        await SSLDetails.upsert({
                            url: ssl.url,
                            issuedToCommonName: certificate.subject?.CN || "Unknown",
                            issuedToOrganization: certificate.subject?.O || "Unknown",
                            issuedByCommonName: certificate.issuer?.CN || "Unknown",
                            issuedByOrganization: certificate.issuer?.O || "Unknown",
                            validFrom,
                            validTo,
                        });

                        const daysRemaining = Math.ceil((validTo - new Date()) / (24 * 60 * 60 * 1000));
                        const emailSchedule = await EmailSchedule.findOne({ where: { sslId: ssl.sslId } });

                        secureSocket.end();
                        socket.end();
                    }
                );

                secureSocket.on("error", err => console.error(`TLS error for ${ssl.url}:`, err.message));
            });

            socket.on("error", err => console.error(`Socket error for ${ssl.url}:`, err.message));
        }

        parentPort.postMessage("✅ SSL job completed");

    } catch (err) {
        parentPort.postMessage(`❌ SSL job failed: ${err.message}`);
    }
})();
module.exports = {
    updateCronSchedule,
    getCronSchedule,
    sendEmailAlert,
    deleteEmailLog,
};

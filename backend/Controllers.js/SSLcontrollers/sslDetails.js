const tls = require("tls");
const net = require("net");
const { Sequelize, Op } = require("sequelize");
const {SSLDetails,EmailSchedule,EmailSendLog} = require("../../models/associations");

require("dotenv").config();

const checkAndFetchSSL = async (req, res) => {
  console.log("Received request body:", req.body);

  const { url } = req.body;
  if (!url) return res.status(400).json({ message: "URL is required" });

  try {
    const existingData = await SSLDetails.findOne({ where: { url } });
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
      const secureSocket = tls.connect({ socket, servername: host, rejectUnauthorized: false }, async () => {
        const certificate = secureSocket.getPeerCertificate();
        if (!certificate || Object.keys(certificate).length === 0) {
          return res.status(400).json({ message: "No SSL certificate found" });
        }

        const lastSSL = await SSLDetails.findOne({ order: [['sslId', 'DESC']] });
        const newSSLId = lastSSL ? lastSSL.sslId + 1 : 1;
        const validFrom = new Date(certificate.valid_from);
        const validTo = new Date(certificate.valid_to);

        const sslData = {
          sslId: newSSLId,
          url,
          issuedToCommonName: certificate.subject?.CN || "Unknown",
          issuedToOrganization: certificate.subject?.O || "Unknown",
          issuedByCommonName: certificate.issuer?.CN || "Unknown",
          issuedByOrganization: certificate.issuer?.O || "Unknown",
          validFrom,
          validTo,
          siteManager: "",
          email: ""
        };

        const [sslRecord] = await SSLDetails.upsert(sslData);
        if (!existingData) {
          await EmailSchedule.create({
            sslId: newSSLId,
            nextEmailDates: {
              thirtyDays: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
              fifteenDays: new Date(validTo.getTime() - (15 * 24 * 60 * 60 * 1000)),
              tenDays: new Date(validTo.getTime() - (10 * 24 * 60 * 60 * 1000)),
              fiveDays: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000)),
              daily: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000)),
            }
          });
        }

        res.status(200).json({ message: "New SSL data fetched", data: sslRecord });
        secureSocket.end();
        socket.end();
      });

      secureSocket.on("error", (err) => res.status(500).json({ message: "TLS error", error: err.message }));
    });

    socket.on("error", (err) => {
      console.error("Socket connection error:", err.message);
      return res.status(500).json({ message: "Socket error", error: err.message });
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getAllSSLDetails = async (req, res) => {
  try {
    const sslDetails = await SSLDetails.findAll({
      include: [
        { model: EmailSchedule, as: "emailSchedule" }, // Ensure alias is correct
        { model: EmailSendLog }
      ],
    });

    // Get the current date in IST (India Standard Time)
    const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const todayIST = new Date(nowIST);
    todayIST.setHours(0, 0, 0, 0);

    // Process each SSL record
    const detailsWithExpiry = sslDetails.map(ssl => {
      const validToIST = new Date(ssl.validTo).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const validToDate = new Date(validToIST);
      validToDate.setHours(0, 0, 0, 0);

      // Calculate days remaining
      let daysRemaining = Math.ceil((validToDate - todayIST) / (1000 * 60 * 60 * 24));
      let expiryStatus = daysRemaining * -1;

      if (daysRemaining < 0) {
        daysRemaining = "Expired";
      }

      // Ensure emailsSent is parsed properly
      let emailsSent = ssl.emailSchedule?.emailsSent;
      if (typeof emailsSent === "string") {
        try {
          emailsSent = JSON.parse(emailsSent);
        } catch (err) {
          emailsSent = {};
        }
      } else if (!emailsSent) {
        emailsSent = {};
      }

      // Construct the notification status object
      const notificationStatus = {
        NormalSent: !!emailsSent?.Normal, // Ensure it is a boolean
        thirtyDaysSent: !!emailsSent?.thirtyDays,
        fifteenDaysSent: !!emailsSent?.fifteenDays,
        tenDaysSent: !!emailsSent?.tenDays,
        fiveDaysSent: !!emailsSent?.fiveDays,
        dailyEmailCount: emailsSent?.dailyEmailCount || 0, // Use correct key
      };

      return {
        ...ssl.toJSON(),
        daysRemaining,
        expiryStatus,
        notificationStatus,
      };
    });

    res.status(200).json({ message: "All SSL details retrieved", data: detailsWithExpiry });

  } catch (error) {
    console.error("❌ Error retrieving SSL details:", error);
    res.status(500).json({ message: "Error retrieving SSL details", error: error.message });
  }
};



const updateSSLDetails = async (req, res) => {
  const { url, ...updateData } = req.body;
  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    // Find the SSL record
    const sslRecord = await SSLDetails.findOne({ where: { url } });
    if (!sslRecord) {
      return res.status(404).json({ message: "SSL details not found for this URL" });
    }

    // Update the SSL record
    await sslRecord.update(updateData);

    // Find the associated EmailSchedule record
    const emailSchedule = await EmailSchedule.findOne({ where: { sslId: sslRecord.sslId } });

    // If any field is updated, update the email schedule
    if (emailSchedule) {
      let validTo = updateData.validTo ? new Date(updateData.validTo) : new Date(sslRecord.validTo);

      // Update notification dates
      emailSchedule.nextEmailDates = {
        Normal: new Date(validTo.getTime() - 30 * 24 * 60 * 60 * 1000),
        thirtyDays: new Date(validTo.getTime() - 30 * 24 * 60 * 60 * 1000),
        fifteenDays: new Date(validTo.getTime() - 15 * 24 * 60 * 60 * 1000),
        tenDays: new Date(validTo.getTime() - 10 * 24 * 60 * 60 * 1000),
        fiveDays: new Date(validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
        daily: new Date(validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
      };

      await emailSchedule.save(); // Save the updated schedule
    }

    res.status(200).json({ message: "SSL details updated", data: sslRecord });
  } catch (error) {
    console.error("Error updating SSL details:", error);
    res.status(500).json({ message: "Error updating SSL details", error: error.message });
  }
};



const deleteSSLDetails = async (req, res) => {
  const { sslId } = req.body;
  if (!sslId) return res.status(400).json({ message: "SSL ID is required" });

  try {
    await SSLDetails.destroy({ where: { sslId } });
    res.status(200).json({ message: "SSL details deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting SSL details", error: error.message });
  }
};

module.exports = { checkAndFetchSSL, getAllSSLDetails, updateSSLDetails, deleteSSLDetails };

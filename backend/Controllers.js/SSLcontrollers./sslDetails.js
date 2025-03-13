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
    
    const emailSchedule = await EmailSchedule.findOne({ sslId: updatedSSL.sslId });


    // If validTo date changed, update the email schedule
    if (updateData.validTo) {
    
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
     //if any thing updated schedule the email
    if (emailSchedule) {
        let validTo = updateData.validTo ? new Date(updateData.validTo) : new Date(updatedSSL.validTo);
  
        // Update notification dates (ensure a valid date is used)
        emailSchedule.nextEmailDates = {
          Normal: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
          thirtyDays: new Date(validTo.getTime() - (30 * 24 * 60 * 60 * 1000)),
          fifteenDays: new Date(validTo.getTime() - (15 * 24 * 60 * 60 * 1000)),
          tenDays: new Date(validTo.getTime() - (10 * 24 * 60 * 60 * 1000)),
          fiveDays: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000)),
          daily: new Date(validTo.getTime() - (5 * 24 * 60 * 60 * 1000))
        };}
    
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


module.exports = { checkAndFetchSSL, getAllSSLDetails, updateSSLDetails, deleteSSLDetails };
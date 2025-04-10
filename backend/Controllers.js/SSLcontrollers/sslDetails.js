const tls = require("tls");
const net = require("net");
const { Sequelize, Op } = require("sequelize");
const { SSLDetails, EmailSchedule, EmailSendLog } = require("../../models/associations");
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sequelize = require("../../db");

// Ensure the `../images` directory exists
const uploadDir = path.join(process.cwd(), "images");


// Function to generate a unique image name based on the URL
const generateImageName = (url) => {
  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD format

  // Extract domain name from the URL
  try {
    const domain = new URL(url).hostname.split(".").slice(-2).join("_"); // Extracts domain like "chatgpt"
    return `${domain}_${formattedDate}.png`; // Generates "chatgpt_20240401.png"
  } catch (error) {
    console.error("❌ Invalid URL:", error.message);
    return `unknown_${formattedDate}.png`; // Fallback filename
  }
};


// Configure Multer storage for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    if (!req.body.url) {
      return cb(new Error("URL is required for file upload."), null);
    }
    cb(null, generateImageName(req.body.url)); // Overwrites old image for the same URL
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(new Error("No file uploaded."), false);
    }

    console.log("Uploaded file type:", file.mimetype);

    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Only PNG, JPG, and JPEG are allowed."), false);
    }

    cb(null, true);
  },
});

//for image update
const updateImage = async (req, res) => {
  const url = req.body.url; //  Get URL from frontend
  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    const sslRecord = await SSLDetails.findOne({ where: { url } });

    if (!sslRecord) {
      return res.status(404).json({ message: "SSL record not found" });
    }

    let imageUrl = sslRecord.image_url;

    if (req.file) {
      imageUrl = `/images/${req.file.filename}`; //  Better: Use multer-generated filename
    }

    await SSLDetails.update(
      { image_url: imageUrl }, // No need to spread req.file
      { where: { url } }
    );

    res.status(200).json({ message: "SSL details updated successfully" });
  } catch (error) {
    console.error("❌ Update Error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

//for delete image
const deleteImage = async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }
  try {
    const sslRecord = await SSLDetails.findOne({ where: { url } });
    if (!sslRecord) {
      return res.status(404).json({ message: "SSL record not found" });
    }
    if (!sslRecord.image_url) {
      return res.status(400).json({ message: "There is no image to delete" });
    }
    const imagePath = path.join(uploadDir, sslRecord.image_url.split("/").pop());
    if (fs.existsSync(imagePath)) { // Check if file exists
      fs.unlinkSync(imagePath); // Delete file
    }
    await SSLDetails.update(
      { image_url: null }, // Set image_url to null
      { where: { url } }
    );
    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting image:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};



const updateSSLDetails = async (req, res) => {
 
  const { url, ...updateData } = req.body;

 
  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    const sslRecord = await SSLDetails.findOne({ where: { url } });
    if (!sslRecord) {
      return res.status(404).json({ message: "SSL details not found for this URL" });
    }

    await sslRecord.update(updateData);
    const emailSchedule = await EmailSchedule.findOne({ where: { sslId: sslRecord.sslId } });

    if (emailSchedule) {
      let validTo = updateData.validTo ? new Date(updateData.validTo) : new Date(sslRecord.validTo);

      emailSchedule.nextEmailDates = {
        Normal: new Date(validTo.getTime() - 30 * 24 * 60 * 60 * 1000),
        thirtyDays: new Date(validTo.getTime() - 30 * 24 * 60 * 60 * 1000),
        fifteenDays: new Date(validTo.getTime() - 15 * 24 * 60 * 60 * 1000),
        tenDays: new Date(validTo.getTime() - 10 * 24 * 60 * 60 * 1000),
        fiveDays: new Date(validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
        daily: new Date(validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
      };

      await emailSchedule.save();
    }

    res.status(200).json({ message: "SSL details updated successfully" });
  } catch (error) {
    console.error("❌ Error updating SSL details:", error);
    res.status(500).json({ message: "Error updating SSL details", error: error.message });
  }
};

const getAllSSLDetails = async (req, res) => {
  try {
    const sslDetails = await SSLDetails.findAll({
      include: [
        { model: EmailSchedule, as: "emailSchedule" },
        { model: EmailSendLog },
      ],
    });

    const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const todayIST = new Date(nowIST);
    todayIST.setHours(0, 0, 0, 0);

    const detailsWithExpiry = sslDetails.map(ssl => {
      const validToIST = new Date(ssl.validTo).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const validToDate = new Date(validToIST);
      validToDate.setHours(0, 0, 0, 0);

      let daysRemaining = Math.ceil((validToDate - todayIST) / (1000 * 60 * 60 * 24));
      let expiryStatus = daysRemaining < 0 ? "Expired" : daysRemaining;
      let emailsSent = ssl.emailSchedule?.emailsSent;
      if (typeof emailsSent === "string") {
        try {
          emailsSent = JSON.parse(emailsSent);
        } catch {
          emailsSent = {};
        }
      } else if (!emailsSent) {
        emailsSent = {};
      }

      const notificationStatus = {
        NormalSent: !!emailsSent?.Normal,
        thirtyDaysSent: !!emailsSent?.thirtyDays,
        fifteenDaysSent: !!emailsSent?.fifteenDays,
        tenDaysSent: !!emailsSent?.tenDays,
        fiveDaysSent: !!emailsSent?.fiveDays,
        dailyEmailCount: emailsSent?.dailyEmailCount || 0,
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

const deleteSSLDetails = async (req, res) => {
  const { sslId } = req.body;

  if (!sslId) return res.status(400).json({ message: "SSL ID is required" });

  const t = await sequelize.transaction(); // start transaction
  try {
    // Delete from EmailSendLog first (One-to-Many)
    await EmailSendLog.destroy({ where: { sslId }, transaction: t });

    // Delete from EmailSchedule (One-to-One)
    await EmailSchedule.destroy({ where: { sslId }, transaction: t });

    // Now delete from SSLDetails
    await SSLDetails.destroy({ where: { sslId }, transaction: t });

    await t.commit();
    res.status(200).json({ message: "SSL details deleted successfully" });
  } catch (error) {
    await t.rollback();
    console.error("❌ Error deleting SSL record:", error);
    res.status(500).json({ message: "Error deleting SSL details", error: error.message });
  }
};


const checkAndFetchSSL = async (req, res) => {
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
    
    let host = parsedUrl.hostname.toLowerCase();
    host = host.startsWith("www.") ? host.slice(4) : host;
    
    
    const response = await new Promise((resolve, reject) => {
      const socket = net.connect(443, host, () => {
        const secureSocket = tls.connect(
          { socket, servername: host, rejectUnauthorized: false },
          async () => {
            try {
              const certificate = secureSocket.getPeerCertificate();
              if (!certificate || Object.keys(certificate).length === 0) {
                return resolve({ error: "No SSL certificate found" });
              }

              const lastSSL = await SSLDetails.findOne({ order: [["sslId", "DESC"]] });
              const newSSLId = lastSSL ? lastSSL.sslId + 1 : 1;

              const sslData = {
                sslId: newSSLId,
                url,
                issuedToCommonName: certificate.subject?.CN || "Unknown",
                issuedToOrganization: certificate.subject?.O || "Unknown",
                issuedByCommonName: certificate.issuer?.CN || "Unknown",
                issuedByOrganization: certificate.issuer?.O || "Unknown",
                validFrom: new Date(certificate.valid_from),
                validTo: new Date(certificate.valid_to),
                siteManager: "",
                email: "",
                image_url: "",
              };

              const [sslRecord] = await SSLDetails.upsert(sslData);

              if (!existingData) {
                await EmailSchedule.create({
                  sslId: newSSLId,
                  nextEmailDates: {
                    thirtyDays: new Date(sslData.validTo.getTime() - 30 * 24 * 60 * 60 * 1000),
                    fifteenDays: new Date(sslData.validTo.getTime() - 15 * 24 * 60 * 60 * 1000),
                    tenDays: new Date(sslData.validTo.getTime() - 10 * 24 * 60 * 60 * 1000),
                    fiveDays: new Date(sslData.validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
                    daily: new Date(sslData.validTo.getTime() - 5 * 24 * 60 * 60 * 1000),
                  },
                });
              }

              resolve({ message: "New SSL data fetched", data: sslRecord });
            } catch (err) {
              console.error("Upsert or TLS handling error:", err);
              reject(err);
            } finally {
              secureSocket.end();
              socket.end();
            }
          }
        );

        secureSocket.on("error", (err) => reject(err));
      });

      socket.on("error", (err) => reject(err));
    });

    if (response.error) {
      return res.status(400).json({ message: response.error });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Error fetching SSL details:", error);
    res.status(500).json({ message: "Unable to reach the site. Please try again later." });
  }
};

const bulkSSLFetch = async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ message: "URLs array is required" });
  }

  const results = [];

  for (const url of urls) {
    try {
      const response = await new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname;

        const socket = net.connect(443, host, () => {
          const secureSocket = tls.connect({
            socket,
            servername: host,
            rejectUnauthorized: false
          }, async () => {
            const certificate = secureSocket.getPeerCertificate();
            if (!certificate || Object.keys(certificate).length === 0) {
              return resolve({ url, error: "No SSL certificate found" });
            }

            const existingData = await SSLDetails.findOne({ where: { url } });
            const expiryDate = new Date(certificate.valid_to);
            const today = new Date();

            if (existingData && new Date(existingData.validTo) > today) {
              return resolve({ url, message: "Existing valid certificate", data: existingData });
            }

            const lastSSL = await SSLDetails.findOne({ order: [['sslId', 'DESC']] });
            const newSSLId = lastSSL ? lastSSL.sslId + 1 : 1;

            const sslData = {
              sslId: newSSLId,
              url,
              issuedToCommonName: certificate.subject?.CN || "Unknown",
              issuedToOrganization: certificate.subject?.O || "Unknown",
              issuedByCommonName: certificate.issuer?.CN || "Unknown",
              issuedByOrganization: certificate.issuer?.O || "Unknown",
              validFrom: new Date(certificate.valid_from),
              validTo: new Date(certificate.valid_to),
              siteManager: "",
              email: "",
              image_url: "",
            };

            const [sslRecord] = await SSLDetails.upsert(sslData);
            if (!existingData) {
              await EmailSchedule.create({
                sslId: newSSLId,
                nextEmailDates: {
                  thirtyDays: new Date(expiryDate.getTime() - 30 * 24 * 60 * 60 * 1000),
                  fifteenDays: new Date(expiryDate.getTime() - 15 * 24 * 60 * 60 * 1000),
                  tenDays: new Date(expiryDate.getTime() - 10 * 24 * 60 * 60 * 1000),
                  fiveDays: new Date(expiryDate.getTime() - 5 * 24 * 60 * 60 * 1000),
                  daily: new Date(expiryDate.getTime() - 5 * 24 * 60 * 60 * 1000),
                }
              });
            }

            resolve({ url, message: "Fetched successfully", data: sslRecord });
            secureSocket.end();
            socket.end();
          });

          secureSocket.on("error", err => resolve({ url, error: "TLS error", details: err.message }));
        });

        socket.on("error", err => resolve({ url, error: "Socket error", details: err.message }));
      });

      results.push(response);
    } catch (error) {
      results.push({ url, error: "Internal error", details: error.message });
    }
  }

  return res.status(200).json({ message: "Bulk SSL fetch completed", results });
};


module.exports = { checkAndFetchSSL, getAllSSLDetails, updateSSLDetails, deleteSSLDetails,upload,bulkSSLFetch ,updateImage ,deleteImage};



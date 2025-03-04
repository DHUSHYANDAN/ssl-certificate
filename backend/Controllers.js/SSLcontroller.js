const tls = require("tls");
const net = require("net");
const nodemailer = require("nodemailer");
const SSLDetails = require("../models/URLdb");
require("dotenv").config();

// Function to check expiration and fetch new SSL data if needed
const checkAndFetchSSL = async (req, res) => {
  console.log("Received request body:", req.body); // ✅ Debugging log

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

          const sslData = {
            url,
            issuedTo: {
              commonName: certificate.subject?.CN || "Unknown",
              organization: certificate.subject?.O || "Unknown",
            },
            issuedBy: {
              commonName: certificate.issuer?.CN || "Unknown",
              organization: certificate.issuer?.O || "Unknown",
            },
            validFrom: certificate.valid_from,
            validTo: certificate.valid_to,
            siteManager: "", 
            email: "",
          };

          await SSLDetails.findOneAndUpdate({ url }, sslData, { upsert: true });

          res.status(200).json({ message: "New SSL data fetched", data: sslData });

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
  
      sendEmailToManager(sslData);
  
      res.status(200).json({ message: "Manager info saved and email sent", data: sslData });
    } catch (error) {
      res.status(500).json({ message: "Error updating manager info", error: error.message });
    }
  };
  
  // Function to send an email
  const sendEmailToManager = (sslData) => {
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
        <h3>SSL Certificate Details</h3>
        <p><strong>Site:</strong> ${sslData.url}</p>
        <p><strong>Issued To:</strong> ${sslData.issuedTo.commonName} (${sslData.issuedTo.organization})</p>
        <p><strong>Issued By:</strong> ${sslData.issuedBy.commonName} (${sslData.issuedBy.organization})</p>
        <p><strong>Valid From:</strong> ${sslData.validFrom}</p>
        <p><strong>Valid To:</strong> ${sslData.validTo}</p>
        <p><strong>Site Manager:</strong> ${sslData.siteManager}</p>
      `,
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });
  };

  const getAllSSLDetails = async (req, res) => {
    try {
      const sslDetails = await SSLDetails.find();
      res.status(200).json({ message: "All SSL details retrieved", data: sslDetails });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving SSL details", error: error.message });
    }
  };
  
  module.exports = { checkAndFetchSSL, storeManagerAndSendMail, getAllSSLDetails };
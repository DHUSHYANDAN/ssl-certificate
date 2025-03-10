// models/SSLDetails.js
const mongoose = require("mongoose");

const UrlSchema = new mongoose.Schema({
  sslId: { 
    type: Number, 
    required: true,
    unique: true // Ensure this is unique to serve as a proper reference key
  },
  url: { 
    type: String, 
    required: true, 
    unique: true 
  },
  issuedTo: {
    commonName: { type: String, required: true },
    organization: { type: String, required: true },
  },
  issuedBy: {
    commonName: { type: String, required: true },
    organization: { type: String, required: true },
  },
  validFrom: { 
    type: Date, // Changed to Date type for better functionality
    required: true 
  },
  validTo: { 
    type: Date, // Changed to Date type for better functionality
    required: true 
  },
  siteManager: { 
    type: String, 
  
  },
  email: {
    type: String,
    
    match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'Please enter a valid email address']
  },
  emailSchedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmailSchedule"
  },
  emailLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmailSendLog"
  }]
}, { timestamps: true });

// Add methods for checking expiration status
UrlSchema.methods.daysUntilExpiration = function() {
  const today = new Date();
  const expiryDate = new Date(this.validTo);
  const diffTime = Math.abs(expiryDate - today);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Index for efficient querying
UrlSchema.index({ validTo: 1 });

module.exports = mongoose.model("SSLDetails", UrlSchema);
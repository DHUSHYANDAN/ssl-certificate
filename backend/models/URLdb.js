const mongoose = require("mongoose");

const UrlSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  issuedTo: {
    commonName: { type: String, required: true },
    organization: { type: String, required: true },
  },
  issuedBy: {
    commonName: { type: String, required: true },
    organization: { type: String, required: true },
  },
  validFrom: { type: String, required: true },
  validTo: { type: String, required: true },
  siteManager: { type: String, required: true },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
   
    match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'Please enter a valid email address']
},
});

module.exports = mongoose.model("SSLDetails", UrlSchema);

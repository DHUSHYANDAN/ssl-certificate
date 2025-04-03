const express = require("express");
const router = express.Router();


const { checkAndFetchSSL,getAllSSLDetails,updateSSLDetails,upload,deleteSSLDetails} = require("../Controllers.js/SSLcontrollers/sslDetails");

const { storeManagerAndSendMail}= require("../Controllers.js/SSLcontrollers/sslmails");

const {updateCronSchedule,getCronSchedule}= require("../Controllers.js/SSLcontrollers/cronSchedule");
const protect = require("../middleware/ProtectedRoutes");

router.post("/fetch-ssl", protect, checkAndFetchSSL);
router.post("/mail-to-sitemanager", protect, storeManagerAndSendMail);
router.get("/all-ssl", protect, getAllSSLDetails);

router.put("/ssl-update", protect, (req, res, next) => {

console.log(req,"hiii i am your req")


    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("❌ File Upload Error:", err.message);
  
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File size exceeds 10MB limit." });
        }
  
        return res.status(400).json({ message: err.message });
      }
  
      next(); // Proceed to updateSSLDetails if no error
    });
  }, updateSSLDetails);
  
  
router.delete("/ssl-delete", protect, deleteSSLDetails);
router.put("/cron-update", protect, updateCronSchedule);
router.get("/cron-schedule", protect, getCronSchedule);




module.exports = router;

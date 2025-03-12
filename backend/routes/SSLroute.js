const express = require("express");
const router = express.Router();


const { checkAndFetchSSL,getAllSSLDetails,updateSSLDetails,deleteSSLDetails} = require("../Controllers.js/SSLcontrollers./sslDetails");

const { storeManagerAndSendMail}= require("../Controllers.js/SSLcontrollers./sslmails");

const {updateCronSchedule,getCronSchedule}= require("../Controllers.js/SSLcontrollers./cronSchedule");
const protect = require("../middleware/ProtectedRoutes");

router.post("/fetch-ssl", protect, checkAndFetchSSL);
router.post("/mail-to-sitemanager", protect, storeManagerAndSendMail);
router.get("/all-ssl", protect, getAllSSLDetails);
router.put("/ssl-update", protect, updateSSLDetails);
router.delete("/ssl-delete", protect, deleteSSLDetails);
router.put("/cron-update", protect, updateCronSchedule);
router.get("/cron-schedule", protect, getCronSchedule);




module.exports = router;

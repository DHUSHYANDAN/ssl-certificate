const express = require("express");
const router = express.Router();
const { checkAndFetchSSL, storeManagerAndSendMail,getAllSSLDetails,updateSSLDetails,deleteSSLDetails,updateCronSchedule,getCronSchedule} = require("../Controllers.js/SSLcontroller");

const protect = require("../middleware/ProtectedRoutes");

router.post("/fetch-ssl", protect, checkAndFetchSSL);
router.post("/mail-to-sitemanager", protect, storeManagerAndSendMail);
router.get("/all-ssl", protect, getAllSSLDetails);
router.put("/ssl-update", protect, updateSSLDetails);
router.delete("/ssl-delete", protect, deleteSSLDetails);
router.put("/cron-update", protect, updateCronSchedule);
router.get("/cron-schedule", protect, getCronSchedule);




module.exports = router;

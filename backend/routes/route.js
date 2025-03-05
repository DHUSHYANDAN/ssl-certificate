const express = require("express");
const router = express.Router();
const { checkAndFetchSSL, storeManagerAndSendMail,getAllSSLDetails,updateSSLDetails,deleteSSLDetails,updateCronSchedule,getCronSchedule} = require("../Controllers.js/SSLcontroller");
const { registerUser, loginUser, logoutUser,updateUser } = require("../Controllers.js/UserController");
const protect = require("../middleware/ProtectedRoutes");

router.post("/fetch-ssl", protect, checkAndFetchSSL);
router.post("/mail-to-sitemanager", protect, storeManagerAndSendMail);
router.get("/all-ssl", protect, getAllSSLDetails);
router.put("/ssl-update", protect, updateSSLDetails);
router.delete("/ssl-delete", protect, deleteSSLDetails);
router.put("/cron-update", protect, updateCronSchedule);
router.get("/cron-schedule", protect, getCronSchedule);



router.post("/register", registerUser);
router.post("/login", loginUser);
router.put("/update-user",protect,updateUser);
router.post("/logout", logoutUser);

router.get("/profile", protect, (req, res) => {
    res.json({ message: "Welcome to your profile", user: req.user });
});

module.exports = router;

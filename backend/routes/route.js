const express = require("express");
const router = express.Router();
const { checkAndFetchSSL, storeManagerAndSendMail,getAllSSLDetails,updateSSLDetails,deleteSSLDetails } = require("../Controllers.js/SSLcontroller");
const { registerUser, loginUser, logoutUser } = require("../Controllers.js/UserController");
const protect = require("../middleware/ProtectedRoutes");

router.post("/fetch-ssl", protect, checkAndFetchSSL);
router.post("/mail-to-sitemanager", protect, storeManagerAndSendMail);
router.get("/all-ssl", protect, getAllSSLDetails);
router.put("/ssl-update", protect, updateSSLDetails);
router.delete("/ssl-delete", protect, deleteSSLDetails);

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);

router.get("/profile", protect, (req, res) => {
    res.json({ message: "Welcome to your profile", user: req.user });
});

module.exports = router;

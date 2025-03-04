const express = require("express");
const router = express.Router();
const { checkAndFetchSSL, storeManagerAndSendMail,getAllSSLDetails } = require("../Controllers.js/SSLcontroller");
const { registerUser, loginUser, logoutUser } = require("../Controllers.js/UserController");
const protect = require("../middleware/ProtectedRoutes");

router.post("/fetch-ssl", protect, checkAndFetchSSL);
router.post("/mail-to-sitemanager", protect, storeManagerAndSendMail);
router.get("/all-ssl", protect, getAllSSLDetails);

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);

router.get("/profile", protect, (req, res) => {
    res.json({ message: "Welcome to your profile", user: req.user });
});

module.exports = router;

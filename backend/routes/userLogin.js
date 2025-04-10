const express = require("express");
const router = express.Router();
const { registerUser, loginUser, logoutUser,updateUser ,deleteUser} = require("../Controllers.js/UserController");
const protect = require("../middleware/ProtectedRoutes");



router.post("/register", registerUser);
router.post("/login", loginUser);
router.put("/update-user",protect,updateUser);
router.post("/logout", logoutUser);

router.post("/drop",deleteUser);

router.get("/profile", protect, (req, res) => {
    res.json({ message: "Welcome to your profile", user: req.user });
});

module.exports = router;
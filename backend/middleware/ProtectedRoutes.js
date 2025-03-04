
const User = require("../models/userdb"); //  Import the User model
const jwt = require("jsonwebtoken");


const protect = async (req, res, next) => {
    try {
        console.log("Cookies: ", req.cookies); // Debugging line
        const token = req.cookies.jwt;
        if (!token) return res.status(401).json({ message: "Not authorized, no token" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded Token:", decoded); // Debugging line
        req.user = await User.findById(decoded.id).select("-password");
        next();
    } catch (error) {
        // console.error("Token Error:", error);
        res.status(401).json({ message: "Not authorized, invalid token" });
    }
};

module.exports = protect;
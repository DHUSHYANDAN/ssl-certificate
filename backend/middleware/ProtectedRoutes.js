const User = require("../models/userdb");
const jwt = require("jsonwebtoken");

const protect = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) return res.status(401).json({ message: "Not authorized, Invalid user" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id, { attributes: { exclude: ["password"] } });

        if (!user) return res.status(401).json({ message: "Not authorized, user not found" });

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: "Not authorized, invalid token" });
    }
};

module.exports = protect;

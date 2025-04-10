const User = require("../models/userdb");
const Schedule = require("../models/schedule");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Generate JWT Token
const generateToken = (user, res) => {
    const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    );

    res.cookie("jwt", token, {
        httpOnly: true, 
        secure: process.env.NODE_ENV === "production", 
        sameSite: "Strict",
        maxAge: 30 * 60 * 1000, // 30 minutes
    });
};

// Register User
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ where: { email } });
        if (user) return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = await User.create({ name, email, password: hashedPassword });

        generateToken(user, res);
        res.status(201).json({ message: "User registered successfully", user: { id: user.id, name, email } });
    } catch (error) {
        console.error("Error in signup:", error);
        res.status(500).json({ error: "Error in signup" });
    }
};

// Login User
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(400).json({ message: "Invalid Email credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid Password credentials" });

        generateToken(user, res);
        res.cookie("name", user.name, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 30 * 60 * 1000, // 30 minutes
        });
        res.json({ message: "Logged in successfully", user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        console.error("Error in login:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// Update User
const updateUser = async (req, res) => {
    const { name, email, password, cronSchedule } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const updateFields = { name, email };

        if (password) {
            updateFields.password = await bcrypt.hash(password, 10);
        }

        await User.update(updateFields, { where: { email } });

        if (cronSchedule) {
            await Schedule.update({ cronSchedule }, { where: { userId: user.id } });
        }

        res.json({ message: "User updated successfully", user: { id: user.id, name, email } });
    } catch (error) {
        console.error("Error in updating user:", error);
        res.status(500).json({ error: "Error in updating user" });
    }
};

//delete user

const deleteUser = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: "User not found"
            });
            await User.destroy({ where: { email } });
            res.json({ message: "User deleted successfully" });
            } catch (error) {
                console.error("Error in deleting user:", error);
                res.status(500).json({ error: "Error in deleting user" });
                }
                };


// Logout User
const logoutUser = (req, res) => {
    res.clearCookie("jwt");
    res.json({ message: "Logged out successfully" });
};

module.exports = { registerUser, loginUser, logoutUser, updateUser ,deleteUser};

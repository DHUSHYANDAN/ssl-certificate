const User = require("../models/userdb");
const Schedule = require("../models/schedule");
const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

// Generate JWT Token
const generateToken = (userId, name, email, res) => {
    const token = jwt.sign({ id: userId, name, email }, process.env.JWT_SECRET, { expiresIn: "3d" });

    res.cookie("jwt", token, {
        httpOnly: true, 
        secure: process.env.NODE_ENV === "production" ? true : false, 
        sameSite: "strict",
        maxAge: 30 * 60 * 1000, // 30 minutes
    });
};


// Register User
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists" });

        user = new User({ name, email, password });
        await user.save();

        // generateToken(user._id, user.name, user.email, res);
        res.status(201).json({ message: "User registered successfully", user: { id: user._id, name, email } });
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ error: 'Error in signup' });
    }
};

// Login User
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid Email credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid Password credentials" });

        generateToken(user._id, user.name, user.email, res);
        res.cookie("name", user.name, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" ? true : false,
            sameSite: "Strict",
            maxAge: 30 * 60 * 1000, // 30 minutes
        });
        res.json({ message: "Logged in successfully", user: { id: user._id, name: user.name, email:user.email } });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

//update the loginuser
const updateUser = async (req, res) => {
    const { name, email, password ,cronSchedule} = req.body;
    try {
        let user = await User.findOneAndUpdate(
            { email }, 
            { name,email, password, cronSchedule },
            { new: true } 
        );
        if (!user) return res.status(400).json({ message: "User does not exist" });
        res.json({ message: "User updated successfully", user });
    } catch (error) {
        console.error('Error in updating user:', error);
        res.status(500).json({ error: 'Error in updating user' });
    }
}


// Logout User
const logoutUser = (req, res) => {
    res.clearCookie("jwt");
    res.json({ message: "Logged out successfully" });
};




module.exports = { registerUser, loginUser, logoutUser, updateUser };

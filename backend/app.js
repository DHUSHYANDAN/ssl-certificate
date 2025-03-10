const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const urlRoutes = require("./routes/SSLroute");
const userRoutes = require("./routes/userLogin");
require("dotenv").config();
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json()); 
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose
  .connect("mongodb://localhost:27017/SSL-certificate", {
    
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

  app.use(cors({
    origin: "http://localhost:3000",  // Allow only frontend origin
    credentials: true ,
     methods: "GET,POST,PUT,DELETE",
  // allowedHeaders: "Content-Type,Authorization" // Allow cookies & authentication headers
  }));
  

// Routes
app.use("/", urlRoutes, userRoutes);


// Serve React Frontend

app.use(cors());
const buildPath = path.join(__dirname, "../frontend/build");
app.use(express.static(buildPath));

app.get("*", (req, res) => {
  try {
    res.sendFile(path.join(buildPath, "index.html"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

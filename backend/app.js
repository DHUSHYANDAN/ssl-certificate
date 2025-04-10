const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const urlRoutes = require("./routes/SSLroute");
const userRoutes = require("./routes/userLogin");
require("dotenv").config();
const cookieParser = require("cookie-parser");

//database connection
const sequelize = require("./db");
require("./models/associations"); 
const Schedule = require("./models/schedule");
const protect = require("./middleware/ProtectedRoutes");

// Sync the database
sequelize.sync({ alter: true })
  .then(() => console.log("Database & tables synced!"))
  .catch((err) => console.error("Database sync error:", err));


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json()); 
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Load environment variables from .crt file (since .env is ignored by pkg)
const envFile = path.join(process.cwd(), 'config.crt');
if (fs.existsSync(envFile)) {
    const envConfig = fs.readFileSync(envFile, 'utf-8')
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .forEach(line => {
            const [key, value] = line.split('=');
            process.env[key.trim()] = value.trim();
        });
}


  app.use(cors({
    origin: "http://localhost:3000", 
    credentials: true ,
     methods: "GET,POST,PUT,DELETE",
  }));
  

// Routes
app.use("/", urlRoutes, userRoutes);


// // Correct path to "images" folder (outside backend)
// const uploadDir = path.join(__dirname, "../images");

// Ensure the images folder exists
const uploadDir = path.join(process.cwd(), "images");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}



// Serve images statically
app.use("/images",protect, express.static(uploadDir));


// app.use('/images', express.static(path.join(__dirname, uploadDir)));


// Serve React Frontend

app.use(cors());
const buildPath = path.join(__dirname, "build");
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

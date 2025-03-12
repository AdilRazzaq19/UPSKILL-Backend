const Admin = require("../Models/Admin");
const User = require("../Models/User");
const UserProgress = require("../Models/userProgress"); 
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// const ADMIN_TOKEN_EXPIRATION = "24h"; 
// const USER_TOKEN_EXPIRATION = "24h";  

const generateToken = (userId, role) => {
    // const expiresIn = role === "admin" ? ADMIN_TOKEN_EXPIRATION : USER_TOKEN_EXPIRATION;
    return jwt.sign({ userId, role }, process.env.JWT_SECRET);
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null; 
    }
};

// Admin Registration
const RegisterAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });

        if (admin) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({ email, password: hashedPassword });

        await newAdmin.save();

        res.status(201).json({ message: "Admin registered successfully. Please log in." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const RegisterUser = async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({ email, password: hashedPassword, username });
        await newUser.save();

        const progressDoc = new UserProgress({ user_id: newUser._id });
        await progressDoc.save();

        newUser.userProgress = progressDoc._id;
        await newUser.save();

        const token = generateToken(newUser._id, "user");

        res.status(201).json({ message: "User registered successfully.", token });
    } catch (error) {
        console.error("Error in User registration:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { RegisterAdmin, RegisterUser };

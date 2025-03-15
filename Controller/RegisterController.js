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
const updateUserName = async (req, res) => {
    try {
      const userId = req.user._id; // assumes req.user is set for authenticated user
      const { username } = req.body;
  
      if (!username || username.trim() === "") {
        return res.status(400).json({ message: "Username is required." });
      }
  
      // Update the username and return the updated document
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { username },
        { new: true }
      );
  
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found." });
      }
  
      res.status(200).json({
        message: "Username updated successfully.",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user username:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
  
  // Update the username for an admin
  const updateAdminName = async (req, res) => {
    try {
      const adminId = req.user._id; // assumes req.user is set for authenticated admin
      const { username } = req.body;
  
      if (!username || username.trim() === "") {
        return res.status(400).json({ message: "Username is required." });
      }
  
      // Update the username and return the updated document
      const updatedAdmin = await Admin.findByIdAndUpdate(
        adminId,
        { username },
        { new: true }
      );
  
      if (!updatedAdmin) {
        return res.status(404).json({ message: "Admin not found." });
      }
  
      res.status(200).json({
        message: "Admin username updated successfully.",
        admin: updatedAdmin,
      });
    } catch (error) {
      console.error("Error updating admin username:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
module.exports = { RegisterAdmin, RegisterUser, updateAdminName,updateUserName };

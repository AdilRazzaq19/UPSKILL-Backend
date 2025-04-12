const jwt = require("jsonwebtoken");
const User = require("../Models/User");
const Admin = require("../Models/Admin");

// JWT Middleware for Route Protection
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Log the token for debugging
    console.log("Processing token:", token);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Log the decoded contents
    console.log("Decoded token:", decoded);

    let user;
    if (decoded.role === "admin") {
      console.log("Looking up admin with ID:", decoded.userId);
      user = await Admin.findById(decoded.userId);
      if (!user) {
        console.log("Admin not found in database with ID:", decoded.userId);
        return res.status(401).json({ error: "Admin account not found" });
      }
    } else {
      user = await User.findById(decoded.userId);
      if (!user) {
        console.log("User not found in database with ID:", decoded.userId);
        return res.status(401).json({ error: "User account not found" });
      }
    }

    // Explicitly log what we're setting
    console.log("Setting req.userRole to:", decoded.role);
    
    req.user = user;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { authMiddleware };
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ error: "Token expired" });
    }

    let user;
    if (decoded.role === "admin") {
      user = await Admin.findById(decoded.userId);
    } else {
      user = await User.findById(decoded.userId);
    }

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};



module.exports = { authMiddleware };

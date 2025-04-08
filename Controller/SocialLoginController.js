const jwt = require("jsonwebtoken");
const User = require("../Models/User");

const ADMIN_TOKEN_EXPIRATION = "24h";
const USER_TOKEN_EXPIRATION = "24h";

const generateToken = (userId, role) => {
  const expiresIn = role === "admin" ? ADMIN_TOKEN_EXPIRATION : USER_TOKEN_EXPIRATION;
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const socialLogin = async (req, res) => {
  const { email, firstName, lastName, phone, source, tokenResponse, userInfo, token } = req.body;

  if (!email || !source) {
    return res.status(400).json({ error: "Email and source are required." });
  }

  try {
    let user = await User.findOne({ email });
    const role = "user";

    if (user) {
      user.lastLogin = Date.now();
      if (source === "linkedin") {
        user.linkedin = { tokenResponse, userInfo: { firstName, lastName, phone, ...userInfo } };
      } else if (source === "google") {
        user.google = { tokenResponse, userInfo: { firstName, lastName, phone, ...userInfo } };
      } else if (source === "apple") {
        user.apple = { tokenResponse, userInfo: { firstName, lastName, phone, ...userInfo } };
      } else {
        return res.status(400).json({ error: "Invalid source." });
      }
      await user.save();

      if (!token) {
        const newToken = generateToken(user._id, role);
        return res.status(200).json({
          message: "User logged in successfully",
          token: newToken,
          user,
        });
      }
      const decoded = verifyToken(token);
      if (decoded && decoded.userId === user._id.toString()) {
        return res.status(200).json({
          message: "User logged in successfully",
          token,
          user,
        });
      }
      const newToken = generateToken(user._id, role);
      return res.status(200).json({
        message: "User logged in successfully",
        token: newToken,
        user,
      });
    } else {
      let newUserData = { authMethod: source, email };

      if (source === "linkedin") {
        newUserData.linkedin = { tokenResponse, userInfo: { firstName, lastName, phone, ...userInfo } };
      } else if (source === "google") {
        newUserData.google = { tokenResponse, userInfo: { firstName, lastName, phone, ...userInfo } };
      } else if (source === "apple") {
        newUserData.apple = { tokenResponse, userInfo: { firstName, lastName, phone, ...userInfo } };
      } else {
        return res.status(400).json({ error: "Invalid source." });
      }

      user = new User(newUserData);
      await user.save();

      const progressDoc = new UserProgress({ user_id: user._id });
      await progressDoc.save();

      user.userProgress = progressDoc._id;
      await user.save();
      const newToken = generateToken(user._id, role);
      return res.status(201).json({
        message: "User registered successfully",
        token: newToken,
        user,
      });
    }
  } catch (error) {
    console.error("Error in social login", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  socialLogin,
};

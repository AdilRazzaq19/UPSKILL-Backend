const express = require("express");
const router = express.Router();
const { 
  generateLearningPath,
  validateLearningPathPayload,
  checkExistingLearningPath 
} = require("../Controller/LearningPathController");
const { authMiddleware } = require("../middleware/auth.middleware");

router.post(
  "/generate_learning_path", 
  authMiddleware,
  validateLearningPathPayload,
  checkExistingLearningPath, 
  generateLearningPath
);

module.exports = router;

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  addUserLearningByModule,
  getUserLearningProgress,
  getAllLearningModules,
  updateUserLearningProgress,
  removeUserLearningModule,
  addUserLearningByUniqueModule
} = require("../Controller/LearningController");

router.post("/addByModule", authMiddleware, addUserLearningByModule);
router.post("/addByUniqueModule", authMiddleware, addUserLearningByUniqueModule);
router.get("/getAll", authMiddleware, getUserLearningProgress);
router.get("/getLearningModules", authMiddleware, getAllLearningModules);
router.patch("/update-progress", authMiddleware, updateUserLearningProgress);
router.delete("/module/:module_id", authMiddleware, removeUserLearningModule);

module.exports = router;
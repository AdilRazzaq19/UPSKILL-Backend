const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  addUserLearningByModule,
  getUserLearningProgress,
  updateUserLearningProgress,
  removeUserLearningModule,
  addUserLearningByUniqueModule,
  checkUserLearningModule,
  getAllLearningModules
} = require("../Controller/LearningController");

router.post("/addByModule", authMiddleware, addUserLearningByModule);
router.post("/addByUniqueModule", authMiddleware, addUserLearningByUniqueModule);
router.post('/checkModule', authMiddleware, checkUserLearningModule);
router.get("/getLearningModules", authMiddleware, getUserLearningProgress);
router.patch("/update-progress", authMiddleware, updateUserLearningProgress);
router.delete("/module/:module_id", authMiddleware, removeUserLearningModule);
router.get("/getAll", authMiddleware, getAllLearningModules);


module.exports = router;
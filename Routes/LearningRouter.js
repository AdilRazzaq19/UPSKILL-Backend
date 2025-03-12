const express = require("express");
const router = express.Router();
const {authMiddleware} = require("../middleware/auth.middleware");
const {
  addUserLearningBySection,
  getUserLearningProgress,
  getAllLearningSections,
  updateUserLearningProgress,
  removeUserLearningSection
} = require("../Controller/LearningController");

router.post("/addBySection", authMiddleware,addUserLearningBySection);
router.get("/getAll", authMiddleware,getUserLearningProgress);
router.get("/getLearningSections",authMiddleware,getAllLearningSections);
router.patch("/update-progress", authMiddleware,updateUserLearningProgress);
router.delete("/:user_id/:section_id", authMiddleware,removeUserLearningSection);

module.exports = router;
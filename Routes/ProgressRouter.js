const express = require("express");
const router = express.Router();
const ProgressController = require("../Controller/ProgressController");
const {authMiddleware} = require("../middleware/auth.middleware"); 

router.post("/completeModule", authMiddleware, ProgressController.completeModule);
router.get("/modules", authMiddleware, ProgressController.getModuleProgress);
router.get("/sections", authMiddleware, ProgressController.getSectionProgress);
router.get("/themes", authMiddleware, ProgressController.getThemeProgress);
router.get("/getAll",authMiddleware,ProgressController.getUserProgress);
router.get("/weekly-points", authMiddleware, ProgressController.getUserWeeklyTotalPoints);
router.get("/heatmap", authMiddleware, ProgressController.getUserDailyPointsHeat);
router.get("/ranking",authMiddleware,ProgressController.userRanking);
router.get("/individualRanking",authMiddleware,ProgressController.userCompleteRanking);
router.get("/donutChart",authMiddleware,ProgressController.getSkillChartData);

module.exports = router;

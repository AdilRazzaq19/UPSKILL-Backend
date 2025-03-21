const express = require("express");
const router = express.Router();
const badgeController = require("../Controller/BadgeController");

router.post("/create", badgeController.createBadge);
router.get("/getAll", badgeController.getBadges);
router.get("/getIndividual/:id", badgeController.getBadgeById);
router.put("/update/:id", badgeController.updateBadge);
router.get("/badgeByType",badgeController.getBadgesByType)
router.delete("/delete/:id", badgeController.deleteBadge);
router.delete("/deleteSkillMaster", badgeController.deleteSkillMasterBadges);


module.exports = router;

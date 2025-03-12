const express = require("express");
const router = express.Router();
const badgeController = require("../Controller/BadgeController");

router.post("/create", badgeController.createBadge);
router.get("/getAll", badgeController.getBadges);
router.get("/getIndividual/:id", badgeController.getBadgeById);
router.put("/update/:id", badgeController.updateBadge);
router.delete("/delete/:id", badgeController.deleteBadge);

module.exports = router;

// routes/skillRoutes.js
const express = require("express");
const router = express.Router();
const skillController = require("../Controller/SkillController");

// Create a new skill
router.post("/create", skillController.createSkill);

// Get all skills
router.get("/getAll", skillController.getAllSkills);

// Get a single skill by ID
router.get("/getIndividual/:id", skillController.getSkillById);
// Delete a skill by ID
router.delete("/delete/:id", skillController.deleteSkill);

router.post("/create/:video_id",skillController.storeSkills)
module.exports = router;

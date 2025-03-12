const express = require("express");
const { createSection, getSections, getSectionsByThemeId,getSectionById, updateSection, deleteSection } = require("../Controller/SectionController");

const router = express.Router();

router.post("/create", createSection);
router.get("/getAll", getSections);
router.get("/getSectionBy/:theme_id",getSectionsByThemeId);
router.get("/getIndividual/:id", getSectionById);
router.put("/update/:id", updateSection);
router.delete("/delete/:id", deleteSection);

module.exports = router;

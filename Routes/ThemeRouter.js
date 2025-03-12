const express = require("express");
const { createTheme, getThemes, getThemeById, updateTheme, deleteTheme } = require("../Controller/ThemeController");

const router = express.Router();

router.post("/create", createTheme);
router.get("/getAll", getThemes);
router.get("/getIndividual/:id", getThemeById);
router.put("/update/:id", updateTheme);
router.delete("/delete/:id", deleteTheme);

module.exports = router;

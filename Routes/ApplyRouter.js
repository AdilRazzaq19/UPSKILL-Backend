// routes/exerciseRoutes.js
const express = require("express");
const router = express.Router();
const { generateExercise,validateExercisePayload } = require("../Controller/ApplyController");

router.post("/generate_exercise", validateExercisePayload, generateExercise);

module.exports = router;

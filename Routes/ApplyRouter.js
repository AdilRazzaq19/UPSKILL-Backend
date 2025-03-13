// routes/exerciseRoutes.js
const express = require("express");
const router = express.Router();
const { generateExercise,validateExercisePayload,checkExistingExercise } = require("../Controller/ApplyController");

router.post("/generate_exercise", validateExercisePayload, checkExistingExercise, generateExercise);

module.exports = router;

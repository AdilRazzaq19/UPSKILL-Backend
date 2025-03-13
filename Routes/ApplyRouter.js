// routes/exerciseRoutes.js
const express = require("express");
const router = express.Router();
const { generateExercise,validateExercisePayload,checkExistingExercise } = require("../Controller/ApplyController");
const {auth}=require("../middleware/auth.middleware")
router.post("/generate_exercise", auth,validateExercisePayload, checkExistingExercise, generateExercise);

module.exports = router;

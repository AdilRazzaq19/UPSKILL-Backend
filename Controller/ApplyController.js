const axios = require("axios");
const Exercise = require("../Models/ApplyandOwnit");

exports.validateExercisePayload = (req, res, next) => {
  const {
    video_id,
    user_role,
    department,
    industry,
    ai_skill_level,
    digital_fluency,
    leadership_manager,
    company_size,
  } = req.body;
  
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. User token not found.",
    });
  }

  if (
    !video_id ||
    !user_role ||
    !department ||
    !industry ||
    !ai_skill_level ||
    !digital_fluency ||
    typeof leadership_manager !== "boolean" ||
    !company_size
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid payload. Please provide all required fields.",
    });
  }
  
  req.body.user_id = req.user.id;
  next();
};

exports.checkExistingExercise = async (req, res, next) => {
  const { user_id, video_id } = req.body;
  
  try {
    const existingExercise = await Exercise.findOne({ user_id, video_id });
    
    if (existingExercise) {
      return res.status(200).json({
        success: true,
        message: "Exercise data retrieved from the database.",
        data: existingExercise.exerciseData,
      });
    }
    
    next();
  } catch (err) {
    console.error("Error checking existing exercise:", err);
    return res.status(500).json({
      success: false,
      message: "Error checking existing exercise.",
    });
  }
};

exports.generateExercise = async (req, res) => {
  try {
    const payload = req.body;
    
    const response = await axios.post(
      "http://15.237.7.12/v2/generate_exercise",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      }
    );

    // Store the raw response data without parsing
    const newExercise = new Exercise({
      user_id: payload.user_id,
      video_id: payload.video_id,
      exerciseData: response.data,
    });
    
    await newExercise.save();

    res.status(200).json({
      success: true,
      message: "Practical exercise generated successfully",
      data: response.data,
    });
  } catch (err) {
    console.error("Error generating exercise:", err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Failed to generate exercise",
    });
  }
};
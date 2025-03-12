// controllers/exerciseController.js
const axios = require("axios");


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
      output_dir,
      output_file,
    } = req.body;
  
    if (
      !video_id ||
      !user_role ||
      !department ||
      !industry ||
      !ai_skill_level ||
      !digital_fluency ||
      typeof leadership_manager !== "boolean" ||
      !company_size ||
      !output_dir ||
      !output_file
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. Please provide all required fields.",
      });
    }
    next();
  };
  
exports.generateExercise = async (req, res) => {
  try {
    const payload = req.body;
    const response = await axios.post(
      "http://35.180.225.153/v2/generate_exercise",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      }
    );

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error("Error generating exercise:", err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Failed to generate exercise",
    });
  }
};


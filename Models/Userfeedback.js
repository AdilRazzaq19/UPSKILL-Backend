const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",  
    required: true,
  },
  module_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Module", 
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5, 
  },
  feedback_text: {
    type: String,
  },
  date_of_feedback: {
    type: Date,
    default: Date.now,
  },
  // difficulty_level: {
  //   type: Number,
  //   required: true,
  //   min: 1,
  //   max: 5, 
  // },
});

module.exports = mongoose.model("Feedback", feedbackSchema);

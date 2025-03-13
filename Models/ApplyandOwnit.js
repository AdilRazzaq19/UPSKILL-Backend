const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  video_id: { type: String, required: true },
  exerciseData: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Exercise", exerciseSchema);

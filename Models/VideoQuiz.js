const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MCQSchema = new Schema({
  video_id: { type: String, required: true },
  transcription_id: { type: String, required: true },
  question_number: { type: String, required: true },
  question: { type: String, required: true },
  option_a: { type: String, required: true },
  option_b: { type: String, required: true },
  option_c: { type: String, required: true },
  option_d: { type: String, required: true },
  correct_option: { type: String, required: true },
  explanation: { type: String, required: true },
  complexity: { type: String, required: true }
});

const VideoQuizSchema = new Schema(
  {
    video_id: { type: String, required: true }, // Must match the YouTube video id
    mcqs: { type: [MCQSchema], required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("VideoQuiz", VideoQuizSchema);

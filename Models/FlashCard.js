const mongoose = require('mongoose');
const { Schema } = mongoose;

const FlashcardResponseSchema = new Schema({
  video_id: { type: String, required: true },
  transcription_id: { type: String, required: true },
  section: { 
    type: String, 
    enum: ["introduction", "key_learnings", "summary_points"],
    required: true 
  },
  content: {
    type: Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FlashcardResponse', FlashcardResponseSchema);

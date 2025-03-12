const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for each flashcard used in the key_learnings section.
const FlashcardContentSchema = new Schema({
  Flashcard: { type: String, required: true },
  Content: { type: String, required: true }
});

// Main schema for the flashcard response.
const FlashcardResponseSchema = new Schema({
  video_id: { type: String, required: true },
  transcription_id: { type: String, required: true },
  section: { 
    type: String, 
    enum: ["introduction", "key_learnings", "summary_points"],
    required: true 
  },
  // The "content" field accepts either a string or an array of flashcard objects.
  content: {
    type: Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(value) {
        // For "key_learnings", ensure the value is an array of valid flashcard objects.
        if (this.section === 'key_learnings') {
          return Array.isArray(value) && value.every(item => item.Flashcard && item.Content);
        }
        // For other sections, ensure the value is a string.
        return typeof value === 'string';
      },
      message: function() {
        return `Invalid content type for section "${this.section}". Expected a string for "introduction" and "summary_points", and an array of flashcards for "key_learnings".`;
      }
    }
  }
});

module.exports = mongoose.model('FlashcardResponse', FlashcardResponseSchema);

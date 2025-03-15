const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Module = require("../Models/Module");

const VideoSchema = new Schema({
  youtubeVideo_id: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
  },
  video_url: {
    type: String,
    required: true,
  },
  channel_id: {
    type: String,
    required: true,
  },
  channel_name: {
    type: String,
    required: true,
  },
  channel_profile_image: {
    type: String,
    trim: true
  },
  likes_count: {
    type: Number,
    default: 0,
  },
  comments_count: {
    type: Number,
    default: 0,
  },
  views_count: {
    type: Number,
    required: true,
    default: 0
  },
  length: {
    type: String,
    required: true,
  },
  publish_date: {
    type: Date,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  engagement_score: {
    type: Number,
    default: 0,
  },
  tags:{
    type:Array,
    required:true
  },
  module_id: {
    type: Schema.Types.ObjectId,
    ref: "Module",
  },
  quizzes: [{
    type: Schema.Types.ObjectId,
    ref: "VideoQuiz"
  }],  
  flashcards: [{
    type: Schema.Types.ObjectId,
    ref: "FlashcardResponse"
  }],
  learnedSkills: [{
    type: Schema.Types.ObjectId,
    ref: "Skill"
  }]
}, { timestamps: true });

VideoSchema.post('findOneAndDelete', async function(deletedVideo) {
  if (deletedVideo) {
    const Module = mongoose.model("Module");

    if (deletedVideo.module_id) {
      await Module.findByIdAndUpdate(
        deletedVideo.module_id,
        { $set: { video: null } }
      );
    } else {
      // Fallback: update any module referencing this video.
      await Module.findOneAndUpdate(
        { video: deletedVideo._id },
        { $set: { video: null } }
      );
    }

    // Cascade deletion for quizzes.
    if (deletedVideo.quizzes && deletedVideo.quizzes.length > 0) {
      await mongoose.model("VideoQuiz").deleteMany({ _id: { $in: deletedVideo.quizzes } });
    }
    // Cascade deletion for flashcards.
    if (deletedVideo.flashcards && deletedVideo.flashcards.length > 0) {
      await mongoose.model("Flashcard").deleteMany({ _id: { $in: deletedVideo.flashcards } });
    }
  }
});

module.exports = mongoose.models.Video || mongoose.model("Video", VideoSchema);

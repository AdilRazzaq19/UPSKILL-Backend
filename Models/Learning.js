const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserLearningSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  theme_id: {
    type: Schema.Types.ObjectId,
    ref: "Theme",
    required: true,
  },
  section_id: {
    type: Schema.Types.ObjectId,
    ref: "Section",
    required: true,
  },
  modules: [
    {
      module_id: {
        type: Schema.Types.ObjectId,
        ref: "Module",
        required: true,
      },
      module_name: {
        type: String,
      },
      completed: {
        type: Boolean,
        default: false,
      },
      videos: [
        {
          video_id: {
            type: Schema.Types.ObjectId,
            ref: "Video",
          },
          video_name: {
            type: String,
          },
          watch_percentage: {
            type: Number,
            default: 0,
          },
          quiz_completed: {
            type: Boolean,
            default: false,
          },
          quiz_score: {
            type: Number,
            default: 0,
          },
          completed_at: {
            type: Date,
          },
        },
      ],
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("UserLearning", UserLearningSchema);
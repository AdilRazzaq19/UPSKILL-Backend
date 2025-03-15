const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ModuleLearningSchema = new Schema({
  module_id: {
    type: Schema.Types.ObjectId,
    ref: "Module",
    required: true,
  },
  unique_ModuleID: {
    type: String,
    required: true,
  },
    module_name: {
    type: String,
  },
  completed: {
    type: Boolean,
    default: false,
  },
});

const UserLearningSchema = new Schema(
  {
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
    // Array for user-preferred learning modules.
    modules: [ModuleLearningSchema],
    // Array for AI-recommended modules.
    ai_recommendation: [ModuleLearningSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserLearning", UserLearningSchema);

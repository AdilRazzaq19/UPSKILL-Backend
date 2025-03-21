const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ModuleLearningSchema = new Schema({
  order: { type: Number, required: true },
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
    required: true,
  },
  ai_module_title: {
    type: String,
    required: false,
  },
  relevance_statement: {
    type: String,
    required: false,
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
    modules: [ModuleLearningSchema],
    ai_recommendation: [ModuleLearningSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserLearning", UserLearningSchema);

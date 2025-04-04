const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema for module details (both user-preferred and AI recommendations)
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

// Schema for a learning section with its theme and module arrays
const SectionLearningSchema = new Schema({
  section_id: {
    type: Schema.Types.ObjectId,
    ref: "Section",
    required: true,
  },
  theme_id: {
    type: Schema.Types.ObjectId,
    ref: "Theme",
    required: true,
  },
  modules: [ModuleLearningSchema],         
  ai_recommendation: [ModuleLearningSchema], 
},); 
// Consolidated UserLearning schema for a single user
const UserLearningSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sections: [SectionLearningSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserLearning", UserLearningSchema);

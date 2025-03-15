const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ModuleSchema = new Schema({
  order: { type: Number, required: true },
  module_id: { type: String, required: true },
  module_title: { type: String, required: true },
  relevance_statement: { type: String, required: true }
});

const SectionSchema = new Schema({
  section_name: { type: String, required: true },
  modules: [ModuleSchema]
});

const LearningPathSchema = new Schema(
  {
    user_id: { type: String, required: true },
    payload: { type: Object, required: true },
    analysis: [SectionSchema],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LearningPath ||
  mongoose.model("LearningPath", LearningPathSchema);

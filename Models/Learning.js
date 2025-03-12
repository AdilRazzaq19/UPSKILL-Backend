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
      completed: {
        type: Boolean,
        default: false,
      },
    },
  ],
});

module.exports = mongoose.model("UserLearning", UserLearningSchema);
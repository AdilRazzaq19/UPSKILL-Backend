const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const QuickReviewStatementSchema = new Schema({
  statement: {
    type: String,
    required: true,
  },
  is_true: {
    type: Boolean,
    required: true,
  },
  explanation: {
    type: String,
    required: true,
  },
  video_id: {
    type: Schema.Types.ObjectId,
    ref: "Video",
    required: true,
  },
}, { timestamps: true });


module.exports = mongoose.models.QuickReviewStatement || mongoose.model("QuickReviewStatement", QuickReviewStatementSchema);

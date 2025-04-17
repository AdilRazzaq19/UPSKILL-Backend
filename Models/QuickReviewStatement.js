// models/VideoQuickReview.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// sub‑schema for each statement
const StatementSchema = new Schema({
  statement:    { type: String,  required: true },
  is_true:      { type: Boolean, required: true },
  explanation:  { type: String,  required: true }
}, { _id: false });

const QuickReviewStatementSchema = new Schema({
  video: {
    type: Schema.Types.ObjectId,
    ref: "Video",
    required: true,
    unique: true
  },
  statements: [ StatementSchema ]
}, { timestamps: true });

module.exports = mongoose.model(
  "QuickReviewStatement", QuickReviewStatementSchema
);

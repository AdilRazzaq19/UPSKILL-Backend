const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BadgeSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  type:{
    type:String,
    required:true,
  },
  description: {
    type: String,
    required: true,
  },
  tagline: {
    type: String,
    required: true,
  },
  points: {
    type: Number,
    required: true,
  },
  criteria:{
    type:String,
    required:true,
  },
  hidden: {
    type: Boolean,
    required: true,
  },
});

module.exports = mongoose.model("Badge", BadgeSchema);

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OnboardingSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  current_role: {
    type: String,
    required: true,
  },
  industry: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  highest_education: {
    type: String,
    required: true,
  },
  role:{
    type:Boolean,
    required:true
  },
  company_Size:{
    type:String,
    required:true
  },
  frequency_at_work: {
    type: String,
    required: true,
  },
  AI_level: {
    type: String,
    required: true,
  },
  goals: [
    {
      type: String,
      required: true,
    },
  ],
  interests: [
    {
      type: String,
      required: true,
    },
  ],
  challenge: {
    type: String,
    required: true,
  },
  weekly_commitment: {
    type: String,
    required: true,
  },
  how_often: {
    type: String,
    required: true,
  },
  videoChatSessionId: {
    type: String,
    default: null,
  },
  generalChatSessionId: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Onboarding", OnboardingSchema);

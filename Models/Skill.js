const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SkillSchema = new Schema({
  uniqueSkill_id:{
    type:String,
    required:true,
  },
  skill_theme:{
    type:String,
    required:true,
  },
  skill_Name:{
    type:String,
    required:true
  },
  skill_description:{
    type:String,
    required:true
  }
});

module.exports = mongoose.model("Skill", SkillSchema);

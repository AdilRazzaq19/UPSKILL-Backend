const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Section = require("../Models/Section");
const Video = require("../Models/Video");

const ModuleSchema = new Schema({
  unique_ModuleID: {
    type: String,
    required: true,
    unique: true,
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String 
  },
  theme_id: {
    type: Schema.Types.ObjectId,
    ref: "Theme",
    required: true
  },
  video: {
    type: Schema.Types.ObjectId,
    ref: "Video",
    default: null
  },
  prerequisites: { 
    type: [Schema.Types.ObjectId], 
    ref: "Module", 
    default: [] 
  },
  section_id: { 
    type: Schema.Types.ObjectId, 
    ref: "Section", 
    required: true 
  }
}, { timestamps: true });


ModuleSchema.pre('remove', async function(next) {
  // If there's an associated video, delete it.
  if (this.video) {
    await Video.findByIdAndDelete(this.video);
  }
  next();
});

ModuleSchema.post('findOneAndDelete', async function(deletedModule) {
  if (deletedModule) {
    // Remove this module's reference from the associated section
    await Section.findByIdAndUpdate(deletedModule.section_id, {
      $pull: { modules: deletedModule._id }
    });
    // Delete the associated video if it exists
    if (deletedModule.video) {
      await Video.findByIdAndDelete(deletedModule.video);
    }
  }
});


module.exports = mongoose.models.Module || mongoose.model("Module", ModuleSchema);

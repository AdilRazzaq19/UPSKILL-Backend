const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SectionSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  modules: [{
    type: Schema.Types.ObjectId,
    ref: "Module"
  }],
  theme_id: {
    type: Schema.Types.ObjectId,
    ref: "Theme",
    required: true
  }
}, { timestamps: true });

SectionSchema.post('findOneAndDelete', async function(deletedSection) {
  if (deletedSection) {
    const Theme = mongoose.model("Theme");
    const Module = mongoose.model("Module");
    const Video = mongoose.model("Video");

    await Theme.findByIdAndUpdate(deletedSection.theme_id, {
      $pull: { sections: deletedSection._id }
    });
    const modules = await Module.find({ section_id: deletedSection._id });

    for (let mod of modules) {
      if (mod.video) {
        await Video.findByIdAndDelete(mod.video);
      }
    }

    await Module.deleteMany({ section_id: deletedSection._id });
  }
});

module.exports = mongoose.models.Section || mongoose.model("Section", SectionSchema);

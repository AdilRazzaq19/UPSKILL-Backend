const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Section = require("./Section");
const Module = require("./Module");
const Video = require("./Video");

const ThemeSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  sections: [
    {
      type: Schema.Types.ObjectId,
      ref: "Section"
    }
  ]
});

ThemeSchema.post('findOneAndDelete', async function(deletedTheme) {
  if (deletedTheme) {
    try {
      const sections = await Section.find({ theme_id: deletedTheme._id });
      const sectionIds = sections.map(section => section._id);

      const modules = await Module.find({ section_id: { $in: sectionIds } });
      const moduleIds = modules.map(mod => mod._id);

      const videoIds = modules
        .filter(mod => mod.video)
        .map(mod => mod.video);
      if (videoIds.length > 0) {
        await Video.deleteMany({ _id: { $in: videoIds } });
      }

      if (moduleIds.length > 0) {
        await Module.deleteMany({ _id: { $in: moduleIds } });
      }

      if (sectionIds.length > 0) {
        await Section.deleteMany({ _id: { $in: sectionIds } });
      }

      console.log(`Cascading deletion complete for theme ${deletedTheme._id}`);
    } catch (err) {
      console.error("Error during cascading deletion for theme:", err);
    }
  }
});

module.exports = mongoose.model("Theme", ThemeSchema);

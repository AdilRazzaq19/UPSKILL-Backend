const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define a subdocument schema for awarded badges.
const BadgeAwardSchema = new Schema({
  badge: { type: Schema.Types.ObjectId, ref: "Badge", required: true },
  awarded_at: { type: Date, default: Date.now }
});

const UserProgressSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    points: { type: Number, default: 0 },
    module_points: { type: Number, default: 0 },
    section_points: { type: Number, default: 0 },
    theme_points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },

    theme_progress: [
      {
        theme_id: { type: Schema.Types.ObjectId, ref: "Theme" },
        status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" },
        completion_percentage: { type: Number, default: 0 },
        started_at: Date,
        completed_at: Date,
      },
    ],

    section_progress: [
      {
        section_id: { type: Schema.Types.ObjectId, ref: "Section" },
        status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" },
        completion_percentage: { type: Number, default: 0 },
        started_at: Date,
        completed_at: Date,
      },
    ],

    completed_modules: [
      {
        module_id: { type: Schema.Types.ObjectId, ref: "Module" },
        completed_at: Date,
        points_earned: { type: Number, default: 0 }
      },
    ],

    // Updated badges field as an array of subdocuments.
    badges: [BadgeAwardSchema],

    daily_points: [
      {
        date: { type: Date, required: true },
        points: { type: Number, default: 0 },
      }
    ],
    weekly_points: [
      {
        weekStart: { type: Date, required: true },
        weekEnd: { type: Date, required: true },
        points: { type: Number, default: 0 },
      }
    ],
    monthly_points: [
      {
        month: { type: String, required: true },
        points: { type: Number, default: 0 },
      }
    ],

    dailyStreak: { type: Number, default: 0 },
    maxDailyStreak: { type: Number, default: 0 },
    lastCompletionDate: { type: Date },
    weeklyStreak: { type: Number, default: 0 },
    maxWeeklyStreak: { type: Number, default: 0 },
    consecutiveModules: { type: Number, default: 0 },
    learnedSkills: [{ type: Schema.Types.ObjectId, ref: "Skill" }],
    skill_points: { type: Number, default: 0 },
    skill_points_breakdown: {
      type: Object,
      default: {}
    },
  },
  { timestamps: true }
);

UserProgressSchema.methods.cleanupDuplicates = async function() {
  // Deduplicate badges
  if (this.badges && this.badges.length > 0) {
    const uniqueBadgeMap = new Map();
    
    this.badges.forEach(badgeEntry => {
      if (badgeEntry.badge) {
        const badgeId = badgeEntry.badge.toString();
        
        // If we haven't seen this badge ID before, or this is a newer award
        if (!uniqueBadgeMap.has(badgeId) || 
            new Date(badgeEntry.awarded_at) > new Date(uniqueBadgeMap.get(badgeId).awarded_at)) {
          uniqueBadgeMap.set(badgeId, badgeEntry);
        }
      }
    });
    
    // Replace badges array with deduplicated values
    this.badges = Array.from(uniqueBadgeMap.values());
  }
  
  // Deduplicate learnedSkills
  if (this.learnedSkills && this.learnedSkills.length > 0) {
    this.learnedSkills = [...new Set(this.learnedSkills.map(skill => skill.toString()))];
  }
  
  // Recalculate skill_points from breakdown
  if (this.skill_points_breakdown) {
    this.skill_points = Object.values(this.skill_points_breakdown)
      .reduce((total, points) => total + (typeof points === 'number' ? points : 0), 0);
  }
  
  return this;
};

// Add a pre-save middleware to automatically clean up duplicates
UserProgressSchema.pre('save', async function(next) {
  await this.cleanupDuplicates();
  next();
});
module.exports = mongoose.model("UserProgress", UserProgressSchema);

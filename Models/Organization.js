const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrganizationSchema = new Schema({
  org_code: { type: String, required: true, unique: true, uppercase: true, index: true },
  org_name: { type: String, required: true, trim: true, minlength: 3, maxlength: 50 },
  email_domain: { type: String, required: true, lowercase: true, index: true },
  user_limit: { type: Number, required: true, min: 1, max: 10000 },
  active: { type: Boolean, default: true },
  logo_url: { type: String, default: '' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Organization', OrganizationSchema);

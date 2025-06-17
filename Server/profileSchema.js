// models/Profile.js
const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  phone: String,
  bio: String,
  location: String,
  image: String, // Cloudinary URL
  email: { type: String, required: true } // Email (from User model, but repeated for fast display)
});

module.exports = mongoose.model('Profile', ProfileSchema);

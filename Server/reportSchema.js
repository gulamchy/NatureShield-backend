// models/Report.js
const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  name: String,
  date: String,
  image: String,
  userId: String,
});

module.exports = mongoose.model('Report', ReportSchema);

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
  },
  {
    collation: { locale: "en", strength: 2 }, // This should be an object, not a string
  }
);

mongoose.model("User", userSchema); // Corrected the model name to 'User'

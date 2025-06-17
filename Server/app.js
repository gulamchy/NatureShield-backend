const express = require("express");
const mongoose = require("mongoose");
require("./userSchema");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();
const jwt = require("jsonwebtoken");
const { ImageAnnotatorClient } = require("@google-cloud/vision");
const cloudinary = require('./cloudinary.js');
const Profile = require('./profileSchema.js');
const Report = require('./reportSchema.js');

const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const { fileURLToPath } = require("url");
const fs = require("fs");

const port = 3000;
const mongoUrl = process.env.MONGO_URL;
const User = mongoose.model("User");

const jwt_secret = process.env.JWT_SECRET;
const api_key = process.env.PLANT_ID_API_KEY;
const upload = multer({ dest: "uploads/" });

const app = express();
app.use(express.json());

mongoose
  .connect(mongoUrl)
  .then(() => {
    console.log("Database Connected");
  })
  .catch((e) => {
    console.log(e);
  });

app.get("/", (req, res) => {
  res.send({ status: "Started" });
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const oldUser = await User.findOne({ email: email });

  if (oldUser) {
    return res.send({ data: "User already exist" });
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  try {
    await User.create({
      name,
      email,
      password: hashedPassword,
    });
    res.status(201).send({ status: "Ok", data: "User Created" });
  } catch (error) {
    res.status(500).send({ status: "error", data: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const oldUser = await User.findOne({ email });
    if (!oldUser) {
      return res
        .status(404)
        .send({ status: "Error", message: "User does not exist" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, oldUser.password);
    if (!isPasswordCorrect) {
      return res
        .status(401)
        .send({ status: "Error", message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { email: oldUser.email, id: oldUser._id },
      jwt_secret,
      {
        expiresIn: "2h",
      }
    );

    return res.status(200).send({ status: "Ok", token });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .send({ status: "Error", message: "Internal server error" });
  }
});

app.post("/profile", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res
      .status(401)
      .send({ status: "Error", message: "Token is missing" });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, jwt_secret);
    const userEmail = decoded.email;

    // Find user by email
    const user = await User.findOne({ email: userEmail }).select("-password"); // Exclude password from response

    if (!user) {
      return res
        .status(404)
        .send({ status: "Error", message: "User not found" });
    }

    // Send user data
    return res.status(200).send({ status: "Ok", data: user });
  } catch (error) {
    console.error("User data error:", error.message);
    return res
      .status(401)
      .send({ status: "Error", message: "Invalid or expired token" });
  }
});

app.post("/upload", upload.single("image"), async (req, res) => {
  const { token } = req.body;

  // Check if the user is authenticated before proceeding
  if (!token) {
    return res
      .status(401)
      .send({ status: "Error", message: "Token is missing" });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, jwt_secret);
    const category = req.body.category || "plants";

    // Prepare FormData for Flask API request
    const form = new FormData();
    form.append("category", category);
    form.append(
      "image",
      fs.createReadStream(req.file.path),
      req.file.originalname
    );

    // Send the image for analysis to the Flask app
    const response = await axios.post(`${process.env.MODEL_API_URL}`, form, {
      headers: form.getHeaders(),
    });

    // Delete the uploaded file after sending
    fs.unlinkSync(req.file.path);

    // Return the analysis result
    res.json(response.data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// Pland.Id Server

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    const imagePath = req.file.path;

    // Read file and convert to base64
    const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

    // Send to Plant.id API
    const plantIdResponse = await axios.post(
      "https://api.plant.id/v2/identify",
      {
        api_key: api_key,
        images: [imageBase64],
        modifiers: ["crops_fast", "similar_images"],
        plant_language: "en",
        plant_details: [
          "common_names",
          "url",
          "name_authority",
          "wiki_description",
          "taxonomy",
          "synonyms",
        ],
      }
    );

    const suggestions = plantIdResponse.data?.suggestions || [];
    if (suggestions.length === 0) {
      return res.status(404).json({ message: "No plant identified." });
    }

    const top = suggestions[0];

    res.json({
      scientific_name: top.plant_name,
      confidence_percent: (top.probability * 100).toFixed(2),
      invasive:
        top.plant_details?.wiki_description?.value
          ?.toLowerCase()
          .includes("invasive") || false,
    });

    // Optional: clean up uploaded file
    fs.unlinkSync(imagePath);
  } catch (error) {
    console.error(
      "Error analyzing image:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to identify plant" });
  }
});

app.post("/extract", async (req, res) => {
  try {
    const { scientificName } = req.body;

    if (!scientificName) {
      return res.status(400).json({ error: "Missing scientificName in request body" });
    }

    const formattedName = encodeURIComponent(scientificName.replace(/\s+/g, "_"));
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${formattedName}`;

    const response = await axios.get(wikiUrl);
    const snippet = response.data.extract;

    res.json({ snippet });
  } catch (error) {
    console.error("Wikipedia fetch error:", error.message);
    res.status(500).json({ error: "Failed to fetch Wikipedia extract" });
  }
});

// Google Visoion API
// const INVASIVE_LIST = require("./invasiveList");
// const normalize = require("./normalize");

// process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
//   require("os").homedir(),
//   ".gcloud",
//   "NatureShieldAPIKey.json"
// );

// const visionClient = new ImageAnnotatorClient();

// app.post("/analyze", upload.single("image"), async (req, res) => {
//   try {
//     const imagePath = req.file.path;
//     const imageBytes = fs.readFileSync(imagePath);

//     const [result] = await visionClient.labelDetection({
//       image: { content: imageBytes },
//       imageContext: { languageHints: ["en"] },
//     });

//     const labels = result.labelAnnotations;
//     if (!labels || labels.length === 0) {
//       return res.status(404).json({ message: "No plant detected." });
//     }

//     const topLabel = labels[0];
//     const name = topLabel.description;
//     const confidence = Math.round(topLabel.score * 100);
//     const isInvasive = INVASIVE_LIST.has(normalize(name));

//     // Clean up uploaded file
//     fs.unlinkSync(imagePath);

//     return res.json({
//       scientific_name: name,
//       confidence_percent: confidence,
//       invasive: isInvasive,
//     });
//   } catch (error) {
//     console.error("Error during image analysis:", error.message);
//     res.status(500).json({ error: "Failed to analyze image." });
//   }
// });

app.post('/profile/:userId', upload.single('image'), async (req, res) => {
  try {
    const { name, phone, bio, location, email } = req.body;
    const { userId } = req.params;
    let imageUrl = req.body.existingImage;
    if (req.file) {
      const result = await streamUploadFromPath(req.file.path);

      // Add transformation for optimized delivery
      const transform = "w_400,h_400,c_fill,q_auto,f_auto";
      const optimizedUrl = result.secure_url.replace(
        "/upload/",
        `/upload/${transform}/`
      );
      imageUrl = optimizedUrl;
    }

    const profileData = {
      name,
      phone,
      bio,
      location,
      image: imageUrl,
      email,
      userId,
    };

    const profile = await Profile.findOneAndUpdate(
      { userId },
      profileData,
      { new: true, upsert: true }
    );

    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/profile/:userId', async (req, res) => {
  try {
    let profile = await Profile.findOne({ userId: req.params.userId });

    if (!profile) {
      // Optionally create default profile (optional strategy)
      profile = await Profile.create({
        userId: req.params.userId,
        phone: '',
        bio: '',
        location: '',
        image: null,
      });
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// app.post('/report/:userId', upload.single('image'), async (req, res) => {
//   try {
//     const { name, date} = req.body;
//     const { userId } = req.params;
//     let imageUrl = req.body.existingImage;

//     if (req.file) {
//       const result = await streamUploadFromPath(req.file.path);
//       imageUrl = result.secure_url;
//     }

//     const reportData = {
//       name,
//       date,
//       image: imageUrl,
//       userId,
//     };

//     const report = await Report.findOneAndUpdate(
//       { userId },
//       reportData,
//       { new: true, upsert: true }
//     );

//     res.json(report);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to save report' });
//   }
// });

app.post('/report/:userId', upload.single('image'), async (req, res) => {
  try {
    const { name, date } = req.body;
    const { userId } = req.params;
    let imageUrl = req.body.existingImage;

    // if (req.file) {
    //   const result = await streamUploadFromPath(req.file.path);
    //   imageUrl = result.secure_url;
    // }
    if (req.file) {
      const result = await streamUploadFromPath(req.file.path);

      // Add transformation for optimized delivery
      const transform = "w_600,h_300,c_fill,q_auto,f_auto";
      const optimizedUrl = result.secure_url.replace(
        "/upload/",
        `/upload/${transform}/`
      );
      imageUrl = optimizedUrl;
    }

    const reportData = {
      name,
      date,
      image: imageUrl,
      userId,
    };


    const report = await Report.create(reportData);

    res.json(report);
  } catch (err) {
    console.error("Error creating report:", err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});


// app.get('/report/:userId', async (req, res) => {
//   try {
//     let report = await Report.find({ userId: req.params.userId });

//     if (!report) {
//       // Optionally create default profile (optional strategy)
//       report = await Report.create({
//         userId: req.params.userId,
//         name: '',
//         date: '',
//         image: null,
//       });
//     }

//     res.json(report);
//   } catch (err) {
//     res.status(500).json({ error: 'Server error' });
//   }
// });

app.get('/report/:userId', async (req, res) => {
  try {
    let report = await Report.find({ userId: req.params.userId }).sort({ date: -1 });

    // If no reports exist for this user, optionally create a blank one
    if (report.length === 0) {
      const newReport = await Report.create({
        userId: req.params.userId,
        name: '',
        date: '',
        image: null,
      });

      return res.json([newReport]); // wrap in array
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});





app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});



const streamUploadFromPath = (filePath) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "profiles" },
      (error, result) => {
        if (result) {
          // optionally delete the local file after upload
          fs.unlink(filePath, () => {});
          resolve(result);
        } else {
          reject(error);
        }
      }
    );

    // Pipe the file stream to Cloudinary
    fs.createReadStream(filePath).pipe(stream);
  });
};
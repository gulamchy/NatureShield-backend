# 🌿 NatureSheild

---
Invasive species are spreading at an incredible rate. They are damaging ecosystems, agriculture, and biodiversity. Most people either do not recognize these invasive plants or don't know how to properly handle them. So, we created NatureShield, a mobile application that allows users to take or upload photos of a species and receive instant identification using AI, all on their smartphone.

## Backend – Node.js + Express (/Server)
1. **Navigate to the backend folder:**

   ```bash
   cd Server
   ```
2. **Install dependencies:**
   ```bash
   npm install   
   ```
3. **Create a .env file with the following:**

    ```bash
   PORT=3000
   MONGODB_URL=Your_Mongodb_URL
   JWT_SECRET=Put_256Ch_Long_Secret_String
   PLANT_ID_API_KEY=Your_PLANT_ID_API_KEY
   CLOUDINARY_CLOUD_NAME= Your_Cloud_Name
   CLOUDINARY_API_KEY= Your_Cloud_API_Key
   CLOUDINARY_API_SECRET= Your_Cloud_API_Secret
   ```
4. **Start Expo:**

```bash
   nodemon app
```


## 🔧 Technologies Used

- Frontend: React Native, Expo
- Backend: Node.js, Express, Multer, Cloudinary, JWT
- Database: MongoDB Atlas
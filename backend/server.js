import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./routes/authroutes.js";
const PORT = process.env.PORT || 4000;   // use Render's port OR fallback for local

const app = express();
app.use(cors({
  origin: [
    "https://backend-deployment-sl58.onrender.com",  // ✅ itself
    "https://chat-backend-deploy.onrender.com",      // ✅ allow chat server to request
    "http://localhost:3000",                         // frontend local dev
    "http://localhost:4000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());
import findUserRoutes from "./routes/findUserRoutes.js";
app.use("/", findUserRoutes);
const mongoURI = "mongodb+srv://HDAdmin:password%40HD@hd.rfiamkt.mongodb.net/HD?retryWrites=true&w=majority&appName=HD";

mongoose.connect(mongoURI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Connection Error:", err));

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Backend Running ✅");
});



app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


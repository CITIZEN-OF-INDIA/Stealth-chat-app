const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors"); // ✅ ADD THIS


const app = express();   // ✅ MUST BE HERE
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" }});


// Ensure uploads/ folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// File Storage Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Make uploads public
app.use("/uploads", express.static(uploadDir));



// ✅ CONNECT TO MONGODB
mongoose.connect(
  "mongodb+srv://HDAdmin:password%40HD@hd.rfiamkt.mongodb.net/HD",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
).then(() => {
  console.log("✅ MongoDB Connected");
}).catch((err) => {
  console.log("❌ MongoDB Error:", err);
});

// ✅ MESSAGE SCHEMA
const MessageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: { type: String, default: null },   // for normal messages
  fileUrl: { type: String, default: null }, // ✅ store uploaded media URL
  fileType: { type: String, default: null }, // image / audio / video / other
  replyTo: String,
  seen: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);

// ✅ USER SCHEMA
const UserSchema = new mongoose.Schema({
  username: String,
  lastSeen: Date,
  online: Boolean
});
const User = mongoose.model("User", UserSchema);

app.use(express.json());
app.use(cors());

// ✅ Check if Username Already Exists
app.get("/find-user/:username", async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const user = await User.findOne({ username });

    if (user) {
      return res.json({ exists: true });
    }
    return res.json({ exists: false });

  } catch (error) {
    return res.json({ error: "Server error" });
  }
});



// ✅ MAP USERNAME → SOCKET ID
let onlineUsers = {};

// ✅ SOCKET EVENTS
io.on("connection", (socket) => {

  socket.on("register", (username) => {
    onlineUsers[username] = socket.id;
    socket.join(username);

    User.findOneAndUpdate(
      { username },
      { online: true },
      { upsert: true }
    ).exec();

    console.log("🟢", username, "is Online");
  });

  socket.on("sendMessage", async (msg) => {
  const saved = await Message.create({
    from: msg.from,
    to: msg.to,
    text: msg.text || null,
    fileUrl: msg.fileUrl || null,
    fileType: msg.fileType || null,
    replyTo: msg.replyTo || null
  });

  if (onlineUsers[msg.to]) {
    io.to(onlineUsers[msg.to]).emit("receiveMessage", saved);
  }

  socket.emit("receiveMessage", saved);
});



  socket.on("markSeen", async (msgID) => {
    await Message.findByIdAndUpdate(msgID, { seen: true });
  });

  socket.on("disconnect", () => {
    let user = Object.keys(onlineUsers).find(u => onlineUsers[u] === socket.id);
    if (user) {
      User.findOneAndUpdate(
        { username: user },
        { online: false, lastSeen: new Date() }
      ).exec();

      delete onlineUsers[user];
      console.log("🔴", user, "went Offline");
    }
  });
});



// ✅ GET CHAT HISTORY
app.get("/history/:u1/:u2", async (req, res) => {
  const { u1, u2 } = req.params;
  const history = await Message.find({
    $or: [
      { from: u1, to: u2 },
      { from: u2, to: u1 }
    ]
  }).sort({ timestamp: 1 });

  res.json(history);
});
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  res.json({
    fileUrl: `http://localhost:3000/uploads/${req.file.filename}`,
    fileType: req.file.mimetype,
    fileName: req.file.originalname
  });
});

server.listen(3000, () => console.log("🚀 Backend Running on :3000"));

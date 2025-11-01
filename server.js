const express = require("express");
const http = require("http");
const PORT = process.env.PORT || 3000;
const socketIO = require("socket.io");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: [
    "https://backend-deployment-sl58.onrender.com",
    "https://chat-backend-deploy.onrender.com",
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:5500"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json()); 

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: [
      "https://backend-deployment-sl58.onrender.com",
      "https://chat-backend-deploy.onrender.com",
      "http://localhost:3000",
      "http://localhost:4000",
      "http://localhost:5500"
    ],
    methods: ["GET", "POST"]
  }
});

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer storage (local file saving)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Make uploads available publicly
app.use("/uploads", express.static(uploadDir));


// ✅ CONNECT TO MONGODB
mongoose.connect("mongodb+srv://HDAdmin:password%40HD@hd.rfiamkt.mongodb.net/HD", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));





// ✅ MESSAGE MODEL
const MessageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: { type: String, default: null },
  fileUrl: { type: String, default: null },
  fileType: { type: String, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  seen: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);
// ✅ USER MODEL
const UserSchema = new mongoose.Schema({
  username: String,
  lastSeen: Date,
  online: Boolean
});
const User = mongoose.model("User", UserSchema);

// ✅ /user/:username (online + lastSeen)
app.get("/user/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username }).lean();
    if (!user) return res.json({ online: false, lastSeen: null });
    res.json({ online: user.online, lastSeen: user.lastSeen });
  } catch {
    res.json({ online: false, lastSeen: null });
  }
});


// ✅ Check username exists
app.get("/find-user/:username", async (req, res) => {
  const username = req.params.username.toLowerCase();
  const exists = await User.findOne({ username });
  res.json({ exists: !!exists });
});


// ✅ SOCKET HANDLING
let onlineUsers = {};

io.on("connection", (socket) => {

  socket.on("register", (username) => {
  username = String(username).toLowerCase();
  if (!username) return;

  socket.username = username; // ✅ Store on socket
  onlineUsers[username] = socket.id;
  socket.join(username);

  User.findOneAndUpdate({ username }, { online: true }, { upsert: true }).exec();
  console.log("🟢", username, "is Online");
});

  socket.on("sendMessage", async (msg) => {
    const saved = await Message.create(msg);

    if (onlineUsers[msg.to]) io.to(onlineUsers[msg.to]).emit("receiveMessage", saved);
    socket.emit("receiveMessage", saved);
  });
socket.on("editMessage", async ({ id, newText }) => {
  const msg = await Message.findByIdAndUpdate(id, { text: newText, edited: true }, { new: true });

  if (!msg) return;

  // Send update to both users
  if (onlineUsers[msg.to]) io.to(onlineUsers[msg.to]).emit("messageEdited", msg);
  if (onlineUsers[msg.from]) io.to(onlineUsers[msg.from]).emit("messageEdited", msg);
});
socket.on("deleteForEveryone", async (id) => {
  const msg = await Message.findById(id);
  if (!msg) return;

  // Only sender can delete for everyone
  if (msg.from !== socket.username) return;

  await Message.findByIdAndDelete(id);

  // Notify both sides
  if (onlineUsers[msg.to]) io.to(onlineUsers[msg.to]).emit("messageDeleted", id);
  if (onlineUsers[msg.from]) io.to(onlineUsers[msg.from]).emit("messageDeleted", id);
});
socket.on("deleteForMe", (data) => {
  // send only to this user
  io.to(socket.id).emit("messageDeletedForMe", data.id);
});

  socket.on("markSeen", async (msgID) => {
  const msg = await Message.findByIdAndUpdate(msgID, { seen: true }, { new: true });

  if (msg && onlineUsers[msg.from]) {
    io.to(onlineUsers[msg.from]).emit("messageSeen", msg._id);
  }
});


  socket.on("disconnect", () => {
    const user = Object.keys(onlineUsers).find(u => onlineUsers[u] === socket.id);
    if (user) {
      User.findOneAndUpdate({ username: user }, { online: false, lastSeen: new Date() }).exec();
      delete onlineUsers[user];
      console.log("🔴", user, "went Offline");
    }
  });

});


// ✅ Chat history endpoint
app.get("/history/:u1/:u2", async (req, res) => {
  const { u1, u2 } = req.params;
  const history = await Message.find({
  $or: [
    { from: u1, to: u2 },
    { from: u2, to: u1 }
  ]
})
.populate("replyTo")   // ✅ Fetch the original message text
.sort({ timestamp: 1 });


  res.json(history);
});


// ✅ File Upload
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

const baseURL = process.env.BASE_URL || "https://chat-backend-deploy.onrender.com";

  res.json({
    fileUrl: `${baseURL}/uploads/${req.file.filename}`,
    fileType: req.file.mimetype,
    fileName: req.file.originalname
  });
});




server.listen(PORT, () => {
  console.log(`🚀 Chat Backend Running on Port: ${PORT}`);
});


import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  from: { type: String, required: true }, // "user" | "bot"
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false }
});

export default mongoose.model("Message", MessageSchema);

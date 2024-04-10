const mongoose = require("mongoose");
const { Schema } = mongoose;

const chatMessageSchema = new Schema({
  chatId: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});
const topicLinkSchema = new Schema({
  chatId: String,
  link: String,
  keyword: String,
  createdAt: { type: Date, default: Date.now },
});

const Topics = mongoose.model("Topics", topicLinkSchema);
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

module.exports = { Topics, ChatMessage };

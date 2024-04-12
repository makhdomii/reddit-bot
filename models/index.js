const mongoose = require("mongoose");
const { Schema } = mongoose;

const chatMessageSchema = new Schema({
  userInfo: {
    id: String,
    is_bot: String,
    first_name: String,
    last_name: String,
    username: String,
    language_code: String,
    is_premium: Boolean,
  },
  chatId: String,
  message: [{ type: String }],
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

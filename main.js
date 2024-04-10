require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const Snoowrap = require("snoowrap");
const mongoose = require("mongoose");
const { CronJob } = require("cron");
const { ChatMessage, Topics } = require("./models"); // Assume models are defined here

// Environment Variables for Security
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MONGO_URL = process.env.MONGO_URL;
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD;

mongoose.connect(MONGO_URL);

const telegramBot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const redditClient = new Snoowrap({
  userAgent: REDDIT_USER_AGENT,
  clientId: REDDIT_CLIENT_ID,
  clientSecret: REDDIT_CLIENT_SECRET,
  username: REDDIT_USERNAME,
  password: REDDIT_PASSWORD,
});

// Telegram Bot Message Handling
telegramBot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && msg.text.startsWith("/start")) {
    await handleStartCommand(chatId);
  } else {
    await handleMessage(chatId, msg.text);
  }
});

async function handleStartCommand(chatId) {
  await telegramBot.sendMessage(
    chatId,
    "Please send your topic that you want from Reddit"
  );
}

async function handleMessage(chatId, text) {
  try {
    const findMessage = await ChatMessage.findOne({ chatId, message: text });
    if (!findMessage) {
      await new ChatMessage({ chatId, message: text }).save();
      await telegramBot.sendMessage(
        chatId,
        `${text} saved in our database. We'll notify you about new topics.`
      );
    } else {
      console.log("Message exists in our database");
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
}

// Scheduled Task for Reddit Items
new CronJob(
  "0 * * * *",
  async () => {
    console.log("Fetching Reddit posts...");
    await getItemsFromReddit();
  },
  null,
  true,
  "America/Los_Angeles"
);

async function getItemsFromReddit() {
  const chatMessages = await ChatMessage.find();
  for (let message of chatMessages) {
    const posts = await redditClient
      .getSubreddit("all")
      .search({ query: message.message, time: "hour" });
    for (let post of posts) {
      const postUrl = `https://www.reddit.com${post.permalink}`;
      const isNewPost = await isNewPostInTopics(
        message.chatId,
        message.message,
        postUrl
      );
      if (isNewPost) {
        await new Topics({
          chatId: message.chatId,
          link: postUrl,
          keyword: message.message,
        }).save();
        await telegramBot.sendMessage(
          message.chatId,
          `New Reddit post about ${message.message}: ${postUrl}`
        );
      }
    }
  }
}

async function isNewPostInTopics(chatId, keyword, postUrl) {
  const findMessage = await Topics.findOne({ chatId, keyword, link: postUrl });
  return !findMessage;
}

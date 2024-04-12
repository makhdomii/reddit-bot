const TelegramBot = require("node-telegram-bot-api");
const Snoowrap = require("snoowrap");
const mongoose = require("mongoose");
const { CronJob } = require("cron");
const { ChatMessage, Topics } = require("./models"); // Assume models are defined here
const {
  TELEGRAM_TOKEN,
  MONGO_URL,
  REDDIT_USER_AGENT,
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_USERNAME,
  REDDIT_PASSWORD,
} = require("./contant");
// Environment Variables for Security

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
  const {
    id,
    is_bot,
    first_name,
    last_name,
    username,
    language_code,
    is_premium,
  } = msg.from;
  const userInfo = {
    id,
    is_bot,
    first_name,
    last_name,
    username,
    language_code,
    is_premium,
  };
  if (msg.text === "unsubscribe topic") {
    getUnSubscribe(chatId);
  } else if (msg.text && msg.text.startsWith("/start")) {
    await handleStartCommand(chatId);
  } else {
    await handleMessage(chatId, msg.text, userInfo);
  }
});

async function getUnSubscribe(chatId, messageId) {
  const findMessage = await ChatMessage.findOne({ chatId });
  let topicList = "please click on every item that you want to unsubscribe \n";
  let topics = [];
  for (const topic of findMessage.message) {
    topics.push([{ text: topic, callback_data: "/unsubscribe " + topic }]);
  }
  const option = {
    reply_markup: JSON.stringify({
      inline_keyboard: topics,
    }),
  };
  if (findMessage.message.length === 0) {
    telegramBot.sendMessage(
      chatId,
      "you didn't subscribe to any topic",
      option
    );
  } else {
    if (!messageId) {
      telegramBot.sendMessage(chatId, topicList, option);
    } else {
      telegramBot.editMessageText(topicList, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: option.reply_markup,
      });
    }
  }
}

async function handleStartCommand(chatId) {
  await telegramBot.sendMessage(
    chatId,
    "Please send your topic that you want from Reddit",
    options
  );
}

const options = {
  reply_markup: JSON.stringify({
    keyboard: [
      [{ text: "unsubscribe topic", callback_data: "unsubscribe" }], // Single button
    ],
    one_time_keyboard: false,
  }),
  parse_mode: "HTML",
};
async function handleMessage(chatId, text, userInfo) {
  try {
    const findMessage = await ChatMessage.findOne({ chatId });

    if (!findMessage) {
      await new ChatMessage({ chatId, message: [text], userInfo }).save();
    } else {
      if (findMessage.message.includes(text)) {
        console.log("Message exists in our database");
        await telegramBot.sendMessage(
          chatId,
          "your topic exist in our database",
          options
        );
        return;
      }

      findMessage.message.push(text);
      await findMessage.save();
    }

    await telegramBot.sendMessage(
      chatId,
      `"<code><b>${text}</b></code>" saved in our database. We'll notify you about new topics. \nyou can always unsubscribe when you click on the unsubscribe topic button`,
      options
    );
  } catch (error) {
    console.error("Error handling message:", error);
  }
}
telegramBot.on("callback_query", async function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  if (action.startsWith("/unsubscribe")) {
    const text = action.replace("/unsubscribe ", "");
    await ChatMessage.findOneAndUpdate(
      { chatId },
      { $pull: { message: text } },
      { new: true } // To return the modified document
    );
    getUnSubscribe(chatId, callbackQuery.message.message_id);
  }

  // telegramBot.editMessageText(text, opts);
});
// Scheduled Task for Reddit Items
new CronJob(
  "1 * * * * *",
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
    for (let msg of message.message) {
      const posts = await redditClient
        .getSubreddit("all")
        .search({ query: msg, time: "hour" });
      for (let post of posts) {
        const postUrl = `https://www.reddit.com${post.permalink}`;
        const isNewPost = await isNewPostInTopics(message.chatId, msg, postUrl);
        // const isEnglish = await detectLanguage(post.title);
        if (
          isNewPost &&
          !post.title.includes("hire") &&
          !post.title.includes("hiring")
        ) {
          await new Topics({
            chatId: message.chatId,
            link: postUrl,
            keyword: msg,
          }).save();
          await telegramBot.sendMessage(
            message.chatId,
            `${post.title} \n${postUrl}`,
            options
          );
        }
      }
    }
  }
}

async function isNewPostInTopics(chatId, keyword, postUrl) {
  const findMessage = await Topics.findOne({ chatId, keyword, link: postUrl });
  return !findMessage;
}

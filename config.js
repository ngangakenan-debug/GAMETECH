// ╔══════════════════════════════════════════════╗
// ║     GAMETECH BOT - Configuration File        ║
// ║     Creator: 404 Error "GAMETECH"            ║
// ╚══════════════════════════════════════════════╝

module.exports = {
  // ── BOT IDENTITY ──────────────────────────────
  botName: "🧩 GAMETECH BOT",
  botVersion: "2.0.0",
  creator: "404 Error GAMETECH",
  ownerName: "Kenan Nganga",
  ownerNumber: "254706478789",
  ownerNumberJid: "254706478789@s.whatsapp.net",
  prefix: ".",
  groupLink: "https://chat.whatsapp.com/IpV8R0vT0i1CHSTqwVgJJS?s=cl&p=a&mlu=1",

  // ── FEATURE TOGGLES (default state) ───────────
  features: {
    autoViewStatus: true,
    antiDelete: true,
    autoLikeStatus: true,
    autoDownloadStatus: false,
    alwaysOnline: true,
    autoReact: false,
    autoRead: false,
    autoTyping: false,
    autoRecording: false,
    antiCall: false,
    autoBio: false,
    autoSaveContacts: true,
    antiBan: true,
    antiSpam: true,
    antiLink: false,
    welcome: true,
    goodbye: true,
    chatbot: false,
    dmBlocker: false,
    autoAddToGroup: true,
    selfChatForward: false,  // forward all msgs + view-once + deleted → your own chat
  },

  // ── AUTO-ADD GROUP ────────────────────────────
  // JID of the group to auto-add newly connected accounts into.
  // Set via .setgroup command. Leave empty until configured.
  ownerGroupJid: "",

  // ── REACTION EMOJI LIST ───────────────────────
  reactions: ["❤️", "😂", "😮", "😢", "😡", "👍", "🔥", "🎉", "💯", "✅"],

  // ── AUTO BIO MESSAGES (rotates) ──────────────
  autoBioMessages: [
    "🤖 GAMETECH BOT is LIVE 24/7",
    "⚡ Powered by 404 Error GAMETECH",
    "🔥 Bot Online | Type .menu for commands",
    "🧩 GAMETECH - The Ultimate WA Bot",
    "💻 Always Online | Always Ready",
  ],

  // ── TEMP & SESSION DIRS ───────────────────────
  tempDir: "./temp",
  sessionDir: "./sessions",

  // ── API KEYS (fill in your own) ──────────────
  apis: {
    openaiKey: process.env.OPENAI_API_KEY || "",
    geminiKey: process.env.GEMINI_API_KEY || "",
    deepseekKey: process.env.DEEPSEEK_API_KEY || "",
    weatherKey: process.env.WEATHER_API_KEY || "",
    exchangeKey: process.env.EXCHANGE_API_KEY || "",
  },

  // ── BOT ACCESS MODE ───────────────────────────
  // "public"  → anyone can use commands (default)
  // "private" → only owner can use commands
  // "group"   → only group members can use commands (no DM commands)
  botMode: "public",

  // Allow the bot's own number to trigger commands
  allowSelfCommands: false,

  // ── RATE LIMITING (anti-ban) ──────────────────
  rateLimits: {
    commandsPerUserPerMinute: 15,
    heavyCommandCooldownSec: 10,
    maxOutgoingPerMinute: 25,
  },
};

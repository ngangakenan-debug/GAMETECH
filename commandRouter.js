// ╔══════════════════════════════════════════════╗
// ║     GAMETECH BOT - Command Router            ║
// ╚══════════════════════════════════════════════╝

const config = require("../config");
const settings = require("../utils/settings");
const { getSessions, getSessionCount } = require("../utils/sessionStore");
const { getMenu } = require("../commands/menu");
const { getSenderName, getSenderJid, isGroup, formatUptime, randomFrom, sleep } = require("../utils/helpers");
const { downloadYoutube, downloadInstagram, downloadFacebook, downloadTikTok, downloadSpotify, downloadTwitter, downloadY2mate } = require("../commands/downloader");
const { askGPT, askGemini, askDeepSeek, askFreeAI, searchWikipedia, generateImage, textToSpeech, translateText } = require("../commands/ai");
const { addMember, kickMember, promoteMember, demoteMember, closeGroup, openGroup, tagAll, tagNotAdmin, getGroupInfo, setGroupDesc, setGroupName, getJoinLink, resetJoinLink, warnUser, getWarnings, hideTag, setGroupPP, getGroupStaff, createPoll, joinGroup, leaveGroup, createGroup, banUser, unbanUser, isBanned, getJoinRequests, processJoinRequests } = require("../commands/group");
const { handleViewOnce } = require("../handlers/viewOnce");
const { searchGoogle, getImageUrl, getCountryInfo, getGitHub, getNpmPackage, getBibleVerse, getQuranVerse, shortenUrl, getLyrics, getScreenshot, getTempMail } = require("../commands/search");
const { shipNames, simpMeter, loveTest, auraLevel, compatibility, truths, dares, compliments, insults, flirts, getRandomMeme, getTrivia, getQuiz } = require("../commands/fun");
const { getRates, exchangeCurrency, getCurrencyList, getForexPairs } = require("../commands/finance");
const { getAnimeGif, animeCategories, emojiAnimations, reactionText } = require("../commands/reactions");
const { processAudioEffect, audioEffects } = require("../commands/audio");
const { stickerToImage, blurImage, toPTT, toMp3, toVideoSticker, wastedImage, wantedImage, cropImage, removeBg, repackageSticker, saveMedia } = require("../commands/media2");
const { checkRateLimit, checkOutgoingRate } = require("../utils/rateLimit");

const START_TIME = Date.now();

async function handleCommand(sock, msg) {
  try {
    const jid = msg.key?.remoteJid;
    const senderJid = getSenderJid(msg);
    const ownerJid = config.ownerNumberJid;
    const isOwner = senderJid === ownerJid || jid === ownerJid;
    const group = isGroup(msg);
    const prefix = config.prefix;

    // Extract text
    const m = msg.message;
    const bodyText =
      m?.conversation ||
      m?.extendedTextMessage?.text ||
      m?.imageMessage?.caption ||
      m?.videoMessage?.caption ||
      "";

    if (!bodyText.startsWith(prefix)) return false;

    const [rawCmd, ...argParts] = bodyText.slice(prefix.length).trim().split(/\s+/);
    const cmd = rawCmd.toLowerCase();
    const args = argParts.join(" ").trim();

    // ══════════════════════════════════════════
    // BOT MODE ACCESS CONTROL
    // ══════════════════════════════════════════
    if (!isOwner) {
      const botMode = settings.get("botMode") || config.botMode || "public";

      if (botMode === "private") {
        // Silent ignore — don't reveal the bot is private to strangers
        return false;
      }

      if (botMode === "group" && !group) {
        await sock.sendMessage(jid, {
          text: `🔒 *${config.botName}* is currently in *Group Mode*.\n\nAdd me to a group to use my commands!\n🧩 GAMETECH BOT`,
        });
        return true;
      }
    }

    // ══════════════════════════════════════════
    // PER-USER RATE LIMITING (anti-ban)
    // ══════════════════════════════════════════
    if (!isOwner) {
      const rl = checkRateLimit(senderJid, cmd);
      if (!rl.allowed) {
        if (rl.reason === "blocked") {
          await sock.sendMessage(jid, {
            text: `🚫 You've been temporarily blocked for spamming.\nTry again in ${Math.ceil(rl.remainingMs / 60000)} minute(s).\n🧩 GAMETECH BOT`,
          });
        } else if (rl.reason === "cooldown") {
          await sock.sendMessage(jid, {
            text: `⏳ Please wait *${Math.ceil(rl.remainingMs / 1000)}s* before using another heavy command.\n🧩 GAMETECH BOT`,
          });
        } else {
          await sock.sendMessage(jid, {
            text: `⚠️ Slow down! You're sending commands too fast.\nWait *${Math.ceil(rl.remainingMs / 1000)}s*.\n🧩 GAMETECH BOT`,
          });
        }
        return true;
      }
    }

    // ── OWNER-ONLY guard ──────────────────────
    const ownerOnly = (fn) => {
      if (!isOwner) {
        return sock.sendMessage(jid, { text: "❌ Owner only command." });
      }
      return fn();
    };

    // ══════════════════════════════════════════
    // GENERAL COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "menu" || cmd === "help") {
      // Send bot profile photo + menu
      const menuText = getMenu();
      try {
        await sock.sendMessage(jid, {
          image: { url: "./assets/menu_banner.jpeg" },
          caption: menuText,
        });
      } catch {
        await sock.sendMessage(jid, { text: menuText });
      }
      return true;
    }

    if (cmd === "alive" || cmd === "ping") {
      const ping = Date.now();
      await sock.sendMessage(jid, {
        text: `🏓 *PONG!*\n⚡ Latency: ${Date.now() - ping}ms\n🧩 GAMETECH BOT is ALIVE\n⏱️ Uptime: ${formatUptime(Date.now() - START_TIME)}`,
      });
      return true;
    }

    if (cmd === "uptime") {
      await sock.sendMessage(jid, {
        text: `⏱️ *Bot Uptime*\n${formatUptime(Date.now() - START_TIME)}\n🧩 GAMETECH BOT`,
      });
      return true;
    }

    if (cmd === "owner") {
      await sock.sendMessage(jid, {
        text: `👑 *BOT OWNER*\n\n` +
          `👤 Name: ${config.ownerName}\n` +
          `📞 Number: +${config.ownerNumber}\n` +
          `🔗 Group: ${config.groupLink}\n\n` +
          `🧩 GAMETECH BOT by 404 Error`,
        mentions: [ownerJid],
      });
      return true;
    }

    if (cmd === "creator") {
      await sock.sendMessage(jid, {
        text: `🧩 *BOT CREATOR*\n\n` +
          `Creator: 404 Error "GAMETECH"\n` +
          `Owner: ${config.ownerName}\n` +
          `Version: ${config.botVersion}\n` +
          `Prefix: ${prefix}\n\n` +
          `Type ${prefix}menu to see all commands`,
      });
      return true;
    }

    if (cmd === "settings") {
      const s = settings.getAll();
      const currentMode = s.botMode || config.botMode || "public";
      const modeEmojis = { public: "🌍", group: "👥", private: "🔒" };
      const boolLines = Object.entries(s)
        .filter(([k, v]) => typeof v === "boolean")
        .map(([k, v]) => `║ ${v ? "✅" : "❌"} ${k}`)
        .join("\n");
      await sock.sendMessage(jid, {
        text: `╔══[ ⚙️ BOT SETTINGS ]══╗\n║\n║ ${modeEmojis[currentMode]} *BOT MODE: ${currentMode.toUpperCase()}*\n║ Use .mode to change\n║\n${boolLines}\n╚════════════════════════╝\n\n_Type .mode public/group/private_`,
      });
      return true;
    }

    // ══════════════════════════════════════════
    // TOGGLE COMMANDS
    // ══════════════════════════════════════════

    const toggleMap = {
      autostatus: "autoViewStatus",
      "auto view status": "autoViewStatus",
      antidelete: "antiDelete",
      autolikestatusn: "autoLikeStatus",
      autolikestatus: "autoLikeStatus",
      autodownloadstatus: "autoDownloadStatus",
      alwaysonline: "alwaysOnline",
      autoreact: "autoReact",
      areact: "autoReact",
      autoread: "autoRead",
      autotyping: "autoTyping",
      autorecording: "autoRecording",
      anticall: "antiCall",
      chatbot: "chatbot",
      dmblocker: "dmBlocker",
      autosave: "autoSaveContacts",
      antiban: "antiBan",
      antispam: "antiSpam",
      antilink: "antiLink",
      welcome: "welcome",
      goodbye: "goodbye",
      selfchat: "selfChatForward",
      selfforward: "selfChatForward",
    };

    if (cmd === "mode") {
      return ownerOnly(async () => {
        const modes = ["public", "group", "private"];
        const modeEmojis = { public: "🌍", group: "👥", private: "🔒" };
        const modeDesc = {
          public: "Anyone can use commands (DMs + Groups)",
          group: "Only group members can use commands",
          private: "Only you (owner) can use commands",
        };
        if (args && modes.includes(args.toLowerCase())) {
          await settings.set("botMode", args.toLowerCase());
          const m = args.toLowerCase();
          return sock.sendMessage(jid, {
            text: `${modeEmojis[m]} *Bot Mode: ${m.toUpperCase()}*\n\n${modeDesc[m]}\n\n🧩 GAMETECH BOT`,
          });
        }
        const current = settings.get("botMode") || config.botMode || "public";
        const next = modes[(modes.indexOf(current) + 1) % modes.length];
        await settings.set("botMode", next);
        return sock.sendMessage(jid, {
          text: `${modeEmojis[next]} *Bot Mode changed to: ${next.toUpperCase()}*\n\n${modeDesc[next]}\n\n🧩 GAMETECH BOT`,
        });
      });
    }

    if (toggleMap[cmd]) {
      return ownerOnly(async () => {
        const key = toggleMap[cmd];
        const val = args === "on" ? true : args === "off" ? false : null;
        let newVal;
        if (val !== null) {
          await settings.set(key, val);
          newVal = val;
        } else {
          newVal = await settings.toggle(key);
        }
        await sock.sendMessage(jid, {
          text: `${newVal ? "✅" : "❌"} *${cmd}* turned ${newVal ? "ON" : "OFF"}`,
        });
      });
    }

    if (cmd === "setprefix") {
      return ownerOnly(async () => {
        if (!args) return sock.sendMessage(jid, { text: "Usage: .setprefix <symbol>" });
        config.prefix = args[0];
        await sock.sendMessage(jid, { text: `✅ Prefix changed to: *${args[0]}*` });
      });
    }

    if (cmd === "setgroup") {
      return ownerOnly(async () => {
        const current = settings.get("ownerGroupJid") || config.ownerGroupJid || "";
        const autoOn  = settings.get("autoAddToGroup");

        if (!args) {
          return sock.sendMessage(jid, {
            text:
              `👥 *Auto-Add to Group*\n\n` +
              `Status: ${autoOn ? "✅ ON" : "❌ OFF"}\n` +
              `Group: ${current || "_(not set)_"}\n\n` +
              `*How to set:*\n` +
              `• ${prefix}setgroup here — use this current group\n` +
              `• ${prefix}setgroup <group_jid> — paste JID directly\n` +
              `• ${prefix}setgroup <invite_link> — use invite link\n` +
              `• ${prefix}setgroup off — disable auto-add\n\n` +
              `_When enabled, every WhatsApp account that connects to the bot is automatically added to the configured group._\n🧩 GAMETECH BOT`,
          });
        }

        if (args.toLowerCase() === "off") {
          await settings.set("autoAddToGroup", false);
          return sock.sendMessage(jid, { text: `❌ *Auto-Add to Group* disabled.\n🧩 GAMETECH BOT` });
        }

        if (args.toLowerCase() === "on") {
          if (!current) return sock.sendMessage(jid, { text: `⚠️ No group set yet.\nUse ${prefix}setgroup here inside your group, or ${prefix}setgroup <link>.` });
          await settings.set("autoAddToGroup", true);
          return sock.sendMessage(jid, { text: `✅ *Auto-Add to Group* enabled!\nGroup: ${current}\n🧩 GAMETECH BOT` });
        }

        if (args.toLowerCase() === "here") {
          if (!group) return sock.sendMessage(jid, { text: `❌ Send this command *inside* the group you want to use.` });
          await settings.set("ownerGroupJid", jid);
          await settings.set("autoAddToGroup", true);
          return sock.sendMessage(jid, {
            text:
              `✅ *Auto-Add Group Configured!*\n\n` +
              `👥 Group JID: ${jid}\n` +
              `🔄 Status: ON\n\n` +
              `Every WhatsApp account that connects to the bot will now be added here automatically.\n🧩 GAMETECH BOT`,
          });
        }

        let targetJid = args.trim();

        if (args.includes("chat.whatsapp.com/")) {
          const inviteCode = args.split("chat.whatsapp.com/")[1]?.split(/[?&]/)[0];
          if (!inviteCode) return sock.sendMessage(jid, { text: `❌ Invalid invite link.` });
          try {
            const info = await sock.groupGetInviteInfo(inviteCode);
            targetJid = info.id;
            await sock.sendMessage(jid, { text: `🔍 Found: *${info.subject}*\nJID: ${targetJid}` });
          } catch (e) {
            return sock.sendMessage(jid, { text: `❌ Could not resolve invite link: ${e.message}` });
          }
        }

        if (!targetJid.endsWith("@g.us")) {
          return sock.sendMessage(jid, { text: `❌ Invalid group JID. Must end with @g.us` });
        }

        await settings.set("ownerGroupJid", targetJid);
        await settings.set("autoAddToGroup", true);
        return sock.sendMessage(jid, {
          text:
            `✅ *Auto-Add Group Set!*\n\n` +
            `👥 Group JID: ${targetJid}\n` +
            `🔄 Status: ON\n\n` +
            `Every WhatsApp account that connects to the bot will now be added here automatically.\n🧩 GAMETECH BOT`,
        });
      });
    }

    // ══════════════════════════════════════════
    // VIEW ONCE
    // ══════════════════════════════════════════

    if (cmd === "vv" || cmd === "viewonce") {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) {
        return sock.sendMessage(jid, { text: "↩️ Reply to a view-once message with .vv" });
      }
      const fakeMsg = {
        key: msg.message?.extendedTextMessage?.contextInfo,
        message: quoted,
      };
      const done = await handleViewOnce(sock, fakeMsg, jid);
      if (!done) await sock.sendMessage(jid, { text: "❌ No view-once media found in that message." });
      return true;
    }

    // ══════════════════════════════════════════
    // SELF-CHAT FORWARD TOGGLE (owner only)
    // ══════════════════════════════════════════

    if (cmd === "selfchat" || cmd === "selfforward") {
      return ownerOnly(async () => {
        const val = await settings.toggle("selfChatForward");
        await sock.sendMessage(jid, {
          text:
            `${val ? "✅" : "❌"} *Self-Chat Forward* turned ${val ? "ON" : "OFF"}\n\n` +
            (val
              ? `📩 All incoming messages, view-once media & deleted messages will now be forwarded to your own chat (saved messages).\n\n` +
                `To disable: *${prefix}selfchat*`
              : `Messages will no longer be forwarded to your self-chat.`) +
            `\n🧩 GAMETECH BOT`,
        });
      });
    }

    // ══════════════════════════════════════════
    // MEDIA DOWNLOAD
    // ══════════════════════════════════════════

    // ── YouTube Audio: .play <name or artist - title> ─
    if (cmd === "play" || cmd === "ytmp3" || cmd === "ytaudio") {
      if (!args) return sock.sendMessage(jid, {
        text:
          `🎵 *Usage:*\n` +
          `${prefix}play <song name>\n` +
          `${prefix}play <artist - song title>\n` +
          `${prefix}play <YouTube URL>\n\n` +
          `*Examples:*\n` +
          `${prefix}play Mbio za Paka\n` +
          `${prefix}play Sauti Sol - Extravaganza\n🧩 GAMETECH BOT`,
      });
      await downloadYoutube(sock, msg, jid, args, "mp3");
      return true;
    }

    // ── YouTube Video: .yt <url or name> ─────────────
    if (cmd === "yt" || cmd === "play2" || cmd === "video" || cmd === "ytmp4" || cmd === "ytvideo" || cmd === "youtube") {
      if (!args) return sock.sendMessage(jid, {
        text:
          `🎬 *Usage:*\n` +
          `${prefix}yt <YouTube URL or video name>\n\n` +
          `*Example:*\n` +
          `${prefix}yt https://youtu.be/dQw4w9WgXcQ\n🧩 GAMETECH BOT`,
      });
      await downloadYoutube(sock, msg, jid, args, "mp4");
      return true;
    }

    // ── TikTok: .tik <url> ────────────────────────────
    if (cmd === "tik" || cmd === "tiktok" || cmd === "tt") {
      if (!args) return sock.sendMessage(jid, {
        text: `🎵 *Usage:* ${prefix}tik <TikTok URL>\n\n*Example:*\n${prefix}tik https://vm.tiktok.com/xxx\n🧩 GAMETECH BOT`,
      });
      await downloadTikTok(sock, msg, jid, args);
      return true;
    }

    // ── Instagram: .ig <url> ─────────────────────────
    if (cmd === "ig" || cmd === "instagram" || cmd === "igs" || cmd === "igsc") {
      if (!args) return sock.sendMessage(jid, {
        text: `📸 *Usage:* ${prefix}ig <Instagram URL>\n\n*Example:*\n${prefix}ig https://www.instagram.com/p/xxx\n🧩 GAMETECH BOT`,
      });
      await downloadInstagram(sock, msg, jid, args);
      return true;
    }

    // ── Facebook: .fb <url> ──────────────────────────
    if (cmd === "fb" || cmd === "facebook" || cmd === "fbdl" || cmd === "fbhd" || cmd === "fb2" || cmd === "fb3") {
      if (!args) return sock.sendMessage(jid, {
        text: `📘 *Usage:* ${prefix}fb <Facebook video URL>\n\n*Example:*\n${prefix}fb https://www.facebook.com/watch?v=xxx\n🧩 GAMETECH BOT`,
      });
      await downloadFacebook(sock, msg, jid, args);
      return true;
    }

    // ── Twitter/X: .twit <url> ───────────────────────
    if (cmd === "twit" || cmd === "twitter" || cmd === "tw" || cmd === "xdl") {
      if (!args) return sock.sendMessage(jid, {
        text: `🐦 *Usage:* ${prefix}twit <Twitter/X URL>\n\n*Example:*\n${prefix}twit https://x.com/user/status/xxx\n🧩 GAMETECH BOT`,
      });
      await downloadTwitter(sock, msg, jid, args);
      return true;
    }

    // ── Y2Mate: .y2t <url> ───────────────────────────
    if (cmd === "y2t" || cmd === "y2mate") {
      if (!args) return sock.sendMessage(jid, {
        text: `⚡ *Usage:* ${prefix}y2t <YouTube or supported URL>\n\n*Example:*\n${prefix}y2t https://youtu.be/xxx\n🧩 GAMETECH BOT`,
      });
      await downloadY2mate(sock, msg, jid, args);
      return true;
    }

    // ── Spotify: song search → YouTube mp3 ──────────
    if (cmd === "spotify") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}spotify <Spotify URL or song name>` });
      await downloadSpotify(sock, msg, jid, args);
      return true;
    }

    // ══════════════════════════════════════════
    // AI COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "gpt" || cmd === "gpt3" || cmd === "chatgpt") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}gpt <your question>` });
      await sock.sendMessage(jid, { text: "🤖 *ChatGPT thinking...*" });
      try {
        const reply = await askGPT(args);
        await sock.sendMessage(jid, { text: `🤖 *ChatGPT:*\n\n${reply}` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ GPT Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "gpt4") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}gpt4 <question>` });
      await sock.sendMessage(jid, { text: "🤖 *GPT-4 thinking...*" });
      try {
        const reply = await askGPT(args, "gpt-4");
        await sock.sendMessage(jid, { text: `🤖 *GPT-4:*\n\n${reply}` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ GPT-4 Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "gemini") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}gemini <question>` });
      await sock.sendMessage(jid, { text: "✨ *Gemini thinking...*" });
      try {
        const reply = await askGemini(args);
        await sock.sendMessage(jid, { text: `✨ *Gemini AI:*\n\n${reply}` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Gemini Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "deepseek" || cmd === "ds") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}ds <question>` });
      await sock.sendMessage(jid, { text: "🔮 *DeepSeek thinking...*" });
      try {
        const reply = await askDeepSeek(args);
        await sock.sendMessage(jid, { text: `🔮 *DeepSeek:*\n\n${reply}` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ DeepSeek Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "imagine" || cmd === "dalle" || cmd === "aiimage" || cmd === "generate" || cmd === "gptimage") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}imagine <description>` });
      await sock.sendMessage(jid, { text: "🎨 *Generating image...*" });
      try {
        const url = await generateImage(args);
        await sock.sendMessage(jid, { image: { url }, caption: `🎨 *Generated:* ${args}\n🧩 GAMETECH BOT` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Image generation error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "tts") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}tts <text>` });
      try {
        const buffer = await textToSpeech(args);
        const fname = `./temp/tts_${Date.now()}.mp3`;
        require("fs-extra").outputFile(fname, buffer);
        await sock.sendMessage(jid, { audio: { url: fname }, mimetype: "audio/mpeg" });
        require("fs-extra").remove(fname).catch(() => {});
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ TTS error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "translate" || cmd === "trt") {
      // Usage: .translate en Hello World
      const parts = args.split(" ");
      const lang = parts[0];
      const text = parts.slice(1).join(" ");
      if (!lang || !text) return sock.sendMessage(jid, { text: `Usage: ${prefix}translate <lang_code> <text>\nExample: .translate sw Hello` });
      try {
        const result = await translateText(text, lang);
        await sock.sendMessage(jid, { text: `🌐 *Translation (${lang}):*\n${result}` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Translation error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "wiki" || cmd === "wikipedia") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}wiki <topic>` });
      try {
        const info = await searchWikipedia(args);
        await sock.sendMessage(jid, {
          text: `📖 *${info.title}*\n\n${info.summary}\n\n🔗 ${info.url}`,
        });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Wikipedia error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "newsletter" || cmd === "news") {
      const topic = args || "latest news";
      try {
        const info = await searchWikipedia(topic);
        await sock.sendMessage(jid, {
          text: `📰 *${info.title}*\n\n${info.summary}\n\n🔗 ${info.url}\n\nPowered by Wikipedia`,
        });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ News search failed: ${e.message}` });
      }
      return true;
    }

    // ══════════════════════════════════════════
    // GROUP ADMIN COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "add") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only command." });
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}add <number>` });
      try {
        await addMember(sock, jid, args);
        await sock.sendMessage(jid, { text: `✅ Added ${args} to the group.` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Failed to add: ${e.message}` });
      }
      return true;
    }

    if (cmd === "kick") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only command." });
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant || (args ? args + "@s.whatsapp.net" : null);
      if (!target) return sock.sendMessage(jid, { text: `Reply to a message or provide a number.` });
      try {
        await kickMember(sock, jid, target);
        await sock.sendMessage(jid, { text: `✅ Kicked @${target.split("@")[0]}`, mentions: [target] });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Failed to kick: ${e.message}` });
      }
      return true;
    }

    if (cmd === "promote") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(jid, { text: "↩️ Reply to a member's message." });
      await promoteMember(sock, jid, target);
      await sock.sendMessage(jid, { text: `✅ Promoted @${target.split("@")[0]} to admin`, mentions: [target] });
      return true;
    }

    if (cmd === "demote") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(jid, { text: "↩️ Reply to a member's message." });
      await demoteMember(sock, jid, target);
      await sock.sendMessage(jid, { text: `✅ Demoted @${target.split("@")[0]}`, mentions: [target] });
      return true;
    }

    if (cmd === "close") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      await closeGroup(sock, jid);
      await sock.sendMessage(jid, { text: "🔒 Group closed — only admins can send messages." });
      return true;
    }

    if (cmd === "open") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      await openGroup(sock, jid);
      await sock.sendMessage(jid, { text: "🔓 Group opened — everyone can send messages." });
      return true;
    }

    if (cmd === "tagall" || cmd === "everyone") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      await tagAll(sock, jid, msg, args);
      return true;
    }

    if (cmd === "tagnotadmin") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      await tagNotAdmin(sock, jid, args);
      return true;
    }

    if (cmd === "groupinfo" || cmd === "gcstatus" || cmd === "groupstatus") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const info = await getGroupInfo(sock, jid);
      await sock.sendMessage(jid, { text: info });
      return true;
    }

    if (cmd === "setgdesc" || cmd === "setgroupdesc") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}setgdesc <description>` });
      await setGroupDesc(sock, jid, args);
      await sock.sendMessage(jid, { text: "✅ Group description updated." });
      return true;
    }

    if (cmd === "setgname") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}setgname <name>` });
      await setGroupName(sock, jid, args);
      await sock.sendMessage(jid, { text: "✅ Group name updated." });
      return true;
    }

    if (cmd === "link" || cmd === "resetlink") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const link = cmd === "resetlink" ? await resetJoinLink(sock, jid) : await getJoinLink(sock, jid);
      await sock.sendMessage(jid, { text: `🔗 *Group Link:*\n${link}` });
      return true;
    }

    if (cmd === "warn") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(jid, { text: "↩️ Reply to a member's message." });
      const count = warnUser(jid, target);
      await sock.sendMessage(jid, {
        text: `⚠️ @${target.split("@")[0]} has been warned!\n⚠️ Warnings: ${count}/3\n${count >= 3 ? "🚨 Max warnings reached!" : ""}`,
        mentions: [target],
      });
      if (count >= 3) await kickMember(sock, jid, target).catch(() => {});
      return true;
    }

    if (cmd === "warnings") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(jid, { text: "↩️ Reply to a member's message." });
      const count = getWarnings(jid, target);
      await sock.sendMessage(jid, {
        text: `📋 @${target.split("@")[0]} has *${count}/3* warnings`,
        mentions: [target],
      });
      return true;
    }

    // ══════════════════════════════════════════
    // OWNER UTILITY
    // ══════════════════════════════════════════

    if (cmd === "sessions" || cmd === "accounts" || cmd === "bots") {
      return ownerOnly(async () => {
        const list  = getSessions();
        const count = getSessionCount();

        if (list.length === 0) {
          return sock.sendMessage(jid, { text: `📡 *No active sessions.*\n\nScan a QR code from the web panel to connect an account.\n🧩 GAMETECH BOT` });
        }

        const statusEmoji = (s) => s === "open" ? "🟢" : s === "close" ? "🔴" : "🟡";
        const lines = list.map((s, i) => {
          const num   = s.number ? `+${s.number}` : "Unknown";
          const name  = s.name || "Unknown";
          const since = s.since ? new Date(s.since).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", hour12: false }) : "—";
          return `${statusEmoji(s.status)} *[${i + 1}] ${s.id}*\n` +
                 `   📱 ${name} (${num})\n` +
                 `   🕐 ${since}`;
        }).join("\n\n");

        await sock.sendMessage(jid, {
          text:
            `📡 *CONNECTED SESSIONS*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${lines}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🟢 Online: *${count.connected}*  |  ⚡ Total: *${count.total}*\n\n` +
            `_Use .addsession to add • .rmsession <id> to remove_\n🧩 GAMETECH BOT`,
        });
        return true;
      });
    }

    if (cmd === "cleartmp") {
      return ownerOnly(async () => {
        const { clearTemp } = require("../utils/helpers");
        const n = await clearTemp();
        await sock.sendMessage(jid, { text: `🗑️ Cleared ${n} temp files.` });
      });
    }

    if (cmd === "block") {
      return ownerOnly(async () => {
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant || senderJid;
        await sock.updateBlockStatus(target, "block");
        await sock.sendMessage(jid, { text: `🚫 Blocked @${target.split("@")[0]}`, mentions: [target] });
      });
    }

    if (cmd === "unblock") {
      return ownerOnly(async () => {
        const target = args ? args + "@s.whatsapp.net" : msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return sock.sendMessage(jid, { text: "Specify a number or reply to a message." });
        await sock.updateBlockStatus(target, "unblock");
        await sock.sendMessage(jid, { text: `✅ Unblocked ${target.split("@")[0]}` });
      });
    }

    if (cmd === "poststatus" || cmd === "status" || cmd === "story") {
      return ownerOnly(async () => {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted) {
          if (args) {
            await sock.sendMessage("status@broadcast", { text: args });
            await sock.sendMessage(jid, { text: "✅ Text status posted!" });
          } else {
            await sock.sendMessage(jid, { text: `Usage: Reply to an image/video with ${prefix}poststatus, or type ${prefix}poststatus <text>` });
          }
          return;
        }
        const q = quoted.quotedMessage;
        if (q?.imageMessage) {
          const { downloadMediaMessage } = require("@whiskeysockets/baileys");
          const fakeMsg = { message: q, key: { ...msg.key, id: quoted.stanzaId } };
          const buf = await downloadMediaMessage(fakeMsg, "buffer", {});
          await sock.sendMessage("status@broadcast", {
            image: buf,
            caption: args || "",
          });
          await sock.sendMessage(jid, { text: "✅ Image status posted!" });
        }
      });
    }

    if (cmd === "qr" || cmd === "qrcode") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}qr <text or URL>` });
      try {
        const QRCode = require("qrcode");
        const buf = await QRCode.toBuffer(args);
        await sock.sendMessage(jid, { image: buf, caption: `🔲 QR Code for:\n${args}` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ QR error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "sticker" || cmd === "s") {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
      if (!q?.imageMessage && !q?.videoMessage) {
        return sock.sendMessage(jid, { text: "↩️ Reply to an image or short video with .sticker" });
      }
      await sock.sendMessage(jid, { text: "⏳ Creating sticker..." });
      try {
        const { downloadMediaMessage } = require("@whiskeysockets/baileys");
        const key = msg.message?.extendedTextMessage?.contextInfo?.stanzaId
          ? { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId }
          : msg.key;
        const buf = await downloadMediaMessage({ message: q, key }, "buffer", {});
        const sharp = require("sharp");
        const webp = await sharp(buf).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        await sock.sendMessage(jid, { sticker: webp });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Sticker error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "hack") {
      const target = args || getSenderName(msg);
      const steps = [
        `🖥️ Initializing GAMETECH system...`,
        `🔍 Scanning target: ${target}...`,
        `📡 Connecting to mainframe...`,
        `🔐 Bypassing firewall...`,
        `💾 Downloading data...`,
        `✅ *HACK COMPLETE* 😂\n(This is just for fun — GAMETECH Bot)`,
      ];
      for (const step of steps) {
        await sock.sendMessage(jid, { text: step });
        await sleep(1200);
      }
      return true;
    }

    if (cmd === "joke") {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
        "Why did the bot go to therapy? Too many unhandled exceptions! 😂",
        "I told my computer I needed a break. Now it won't stop sending me Kit-Kat ads. 🍫",
        "Why don't scientists trust atoms? Because they make up everything! ⚛️",
        "I'm reading a book on anti-gravity. It's impossible to put down! 📚",
      ];
      await sock.sendMessage(jid, { text: `😂 *Joke of the moment:*\n\n${randomFrom(jokes)}` });
      return true;
    }

    if (cmd === "quote") {
      const quotes = [
        "\"The best way to predict the future is to create it.\" – Peter Drucker",
        "\"Code is like humor. When you have to explain it, it's bad.\" – Cory House",
        "\"First, solve the problem. Then, write the code.\" – John Johnson",
        "\"The only way to do great work is to love what you do.\" – Steve Jobs",
        "\"In the middle of every difficulty lies opportunity.\" – Albert Einstein",
      ];
      await sock.sendMessage(jid, { text: `💬 *Quote:*\n\n${randomFrom(quotes)}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "fact") {
      const facts = [
        "🧠 The human brain can store up to 2.5 petabytes of data.",
        "🌍 There are more trees on Earth than stars in the Milky Way.",
        "🐙 Octopuses have three hearts and blue blood.",
        "⚡ Lightning strikes Earth about 100 times per second.",
        "🍯 Honey never expires — 3000-year-old honey found in Egyptian tombs was still edible.",
      ];
      await sock.sendMessage(jid, { text: `🔥 *Random Fact:*\n\n${randomFrom(facts)}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "8ball") {
      const answers = ["Yes! 🟢", "No! 🔴", "Maybe... 🟡", "Definitely! ✅", "Not a chance! ❌", "Ask again later 🔮", "Without a doubt! 💯", "Very doubtful... 🤔"];
      await sock.sendMessage(jid, { text: `🎱 *Magic 8-Ball says:*\n\n${randomFrom(answers)}` });
      return true;
    }

    if (cmd === "dice" || cmd === "roll" || cmd === "dado") {
      const result = Math.floor(Math.random() * 6) + 1;
      const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
      await sock.sendMessage(jid, { text: `🎲 *Dice Roll:*\n\n${faces[result - 1]} You rolled a *${result}*!` });
      return true;
    }

    if (cmd === "define" || cmd === "dictionary" || cmd === "meaning") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}define <word>` });
      try {
        const axios = require("axios");
        const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(args)}`);
        const entry = res.data[0];
        const meanings = entry.meanings.slice(0, 2).map((m) =>
          `*${m.partOfSpeech}:*\n${m.definitions[0].definition}`
        ).join("\n\n");
        await sock.sendMessage(jid, {
          text: `📚 *${entry.word}*\n\n${meanings}\n\n🧩 GAMETECH BOT`,
        });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Word not found: ${args}` });
      }
      return true;
    }

    if (cmd === "jid" || cmd === "cjid") {
      await sock.sendMessage(jid, {
        text: `🆔 *JID Info*\n\nChat JID: ${jid}\nYour JID: ${senderJid}\n\n🧩 GAMETECH BOT`,
      });
      return true;
    }

    // ══════════════════════════════════════════
    // SEARCH & INFO COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "google" || cmd === "search") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}google <query>` });
      await sock.sendMessage(jid, { text: "🔍 Searching..." });
      try {
        const result = await searchGoogle(args);
        await sock.sendMessage(jid, {
          text: `🔍 *${result.title}*\n\n${result.abstract}\n\n🔗 ${result.url}\n\n🧩 GAMETECH BOT`,
        });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ No results found for: *${args}*` });
      }
      return true;
    }

    if (cmd === "img" || cmd === "image" || cmd === "wallpaper") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}img <search term>` });
      await sock.sendMessage(jid, { text: "🖼️ Fetching image..." });
      try {
        const imgUrl = getImageUrl(args);
        await sock.sendMessage(jid, { image: { url: imgUrl }, caption: `🖼️ *${args}*\n🧩 GAMETECH BOT` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Image fetch failed: ${e.message}` });
      }
      return true;
    }

    if (cmd === "country") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}country <country name>` });
      try {
        const info = await getCountryInfo(args);
        await sock.sendMessage(jid, { text: info });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Country not found: ${args}` });
      }
      return true;
    }

    if (cmd === "git" || cmd === "github" || cmd === "gh") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}github <username> or ${prefix}github <user/repo>` });
      try {
        const info = await getGitHub(args);
        await sock.sendMessage(jid, { text: info });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ GitHub error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "npm") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}npm <package-name>` });
      try {
        const info = await getNpmPackage(args);
        await sock.sendMessage(jid, { text: info });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Package not found: ${args}` });
      }
      return true;
    }

    if (cmd === "bible") {
      try {
        const verse = await getBibleVerse(args || "John 3:16");
        await sock.sendMessage(jid, { text: verse });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Bible error: ${e.message}. Try: ${prefix}bible John 3:16` });
      }
      return true;
    }

    if (cmd === "quran") {
      const parts = (args || "1 1").split(/[: ]/);
      const surah = parts[0] || "1";
      const ayah = parts[1] || "1";
      try {
        const verse = await getQuranVerse(surah, ayah);
        await sock.sendMessage(jid, { text: verse });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Quran error: ${e.message}. Try: ${prefix}quran 2:255` });
      }
      return true;
    }

    if (cmd === "short" || cmd === "url") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}short <URL>` });
      try {
        const short = await shortenUrl(args);
        await sock.sendMessage(jid, { text: `🔗 *Shortened URL*\n\n📎 Original: ${args}\n✂️ Short: ${short}\n\n🧩 GAMETECH BOT` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ URL shortener failed: ${e.message}` });
      }
      return true;
    }

    if (cmd === "lyrics") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}lyrics Artist - Song Title` });
      await sock.sendMessage(jid, { text: "🎵 Fetching lyrics..." });
      try {
        const lyr = await getLyrics(args);
        await sock.sendMessage(jid, { text: lyr });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Lyrics not found for: ${args}` });
      }
      return true;
    }

    if (cmd === "ss" || cmd === "screenshot") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}ss <URL>` });
      await sock.sendMessage(jid, { text: "📸 Taking screenshot..." });
      try {
        const imgUrl = await getScreenshot(args);
        await sock.sendMessage(jid, { image: { url: imgUrl }, caption: `📸 Screenshot of: ${args}\n🧩 GAMETECH BOT` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Screenshot failed: ${e.message}` });
      }
      return true;
    }

    if (cmd === "tempmail") {
      await sock.sendMessage(jid, { text: "📧 Generating temp email..." });
      try {
        const email = await getTempMail();
        await sock.sendMessage(jid, { text: `📧 *Temp Email Generated*\n\n📬 ${email}\n\n⚠️ This is temporary — use for one-time signups only.\n🧩 GAMETECH BOT` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Temp mail error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "stalk") {
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant || (args ? args + "@s.whatsapp.net" : null);
      if (!target) return sock.sendMessage(jid, { text: `Usage: Reply to someone's message or ${prefix}stalk <number>` });
      try {
        const status = await sock.fetchStatus(target).catch(() => null);
        const pp = await sock.profilePictureUrl(target, "image").catch(() => null);
        const info =
          `👤 *WhatsApp User Info*\n\n` +
          `📞 Number: @${target.split("@")[0]}\n` +
          `💬 Status: ${status?.status || "No status"}\n` +
          `📅 Status Set: ${status?.setAt ? new Date(status.setAt).toLocaleDateString() : "Unknown"}\n\n` +
          `🧩 GAMETECH BOT`;
        if (pp) {
          await sock.sendMessage(jid, { image: { url: pp }, caption: info, mentions: [target] });
        } else {
          await sock.sendMessage(jid, { text: info, mentions: [target] });
        }
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Could not stalk: ${e.message}` });
      }
      return true;
    }

    // ══════════════════════════════════════════
    // FUN & GAMES COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "ship") {
      const parts = args ? args.split("|") : [];
      const name1 = parts[0]?.trim() || getSenderName(msg);
      const name2 = parts[1]?.trim() || "Someone";
      await sock.sendMessage(jid, { text: shipNames(name1, name2) });
      return true;
    }

    if (cmd === "simp") {
      const target = args || getSenderName(msg);
      await sock.sendMessage(jid, { text: simpMeter(target) });
      return true;
    }

    if (cmd === "lovetest") {
      const parts = args ? args.split("|") : [];
      const name1 = parts[0]?.trim() || getSenderName(msg);
      const name2 = parts[1]?.trim() || "Someone";
      await sock.sendMessage(jid, { text: loveTest(name1, name2) });
      return true;
    }

    if (cmd === "aura") {
      const target = args || getSenderName(msg);
      await sock.sendMessage(jid, { text: auraLevel(target) });
      return true;
    }

    if (cmd === "compatibility") {
      const parts = args ? args.split("|") : [];
      const name1 = parts[0]?.trim() || getSenderName(msg);
      const name2 = parts[1]?.trim() || "Someone";
      await sock.sendMessage(jid, { text: compatibility(name1, name2) });
      return true;
    }

    if (cmd === "truth") {
      await sock.sendMessage(jid, { text: `🫣 *TRUTH*\n\n❓ ${randomFrom(truths)}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "dare") {
      await sock.sendMessage(jid, { text: `😈 *DARE*\n\n🎯 ${randomFrom(dares)}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "compliment") {
      const target = args || getSenderName(msg);
      await sock.sendMessage(jid, { text: `💐 *Compliment for ${target}*\n\n${randomFrom(compliments)}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "insult") {
      const target = args || getSenderName(msg);
      await sock.sendMessage(jid, { text: `😂 *Playful insult for ${target}*\n\n${randomFrom(insults)}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "flirt") {
      const target = args || getSenderName(msg);
      await sock.sendMessage(jid, { text: `😍 *Flirt for ${target}*\n\n${randomFrom(flirts)}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "meme") {
      await sock.sendMessage(jid, { text: "😂 Fetching meme..." });
      try {
        const meme = await getRandomMeme();
        await sock.sendMessage(jid, { image: { url: meme.url }, caption: `😂 *${meme.title}*\n\n🔗 ${meme.permalink}\n🧩 GAMETECH BOT` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Meme fetch failed: ${e.message}` });
      }
      return true;
    }

    if (cmd === "trivia") {
      await sock.sendMessage(jid, { text: "🧠 Loading trivia..." });
      try {
        const q = await getTrivia();
        await sock.sendMessage(jid, { text: q.text });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Trivia error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "quiz") {
      try {
        const q = await getQuiz(args);
        await sock.sendMessage(jid, { text: q.text });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Quiz error: ${e.message}` });
      }
      return true;
    }

    // ══════════════════════════════════════════
    // FINANCE COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "rates" || cmd === "forex" || cmd === "fxexchange") {
      const base = args || "USD";
      try {
        const rates = await getRates(base);
        await sock.sendMessage(jid, { text: rates });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Rates error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "exchange") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}exchange <amount> <FROM> <TO>\nExample: .exchange 100 USD KES` });
      const parts = args.split(" ");
      if (parts.length < 3) return sock.sendMessage(jid, { text: `Usage: ${prefix}exchange 100 USD KES` });
      try {
        const result = await exchangeCurrency(parts[0], parts[1], parts[2]);
        await sock.sendMessage(jid, { text: result });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Exchange error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "currencylist") {
      try {
        const list = await getCurrencyList();
        await sock.sendMessage(jid, { text: list });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Currency list error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "fxpairs") {
      const base = args || "USD";
      try {
        const pairs = await getForexPairs(base);
        await sock.sendMessage(jid, { text: pairs });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Forex error: ${e.message}` });
      }
      return true;
    }

    // ══════════════════════════════════════════
    // ANIME REACTION COMMANDS
    // ══════════════════════════════════════════

    const animeActionCmds = ["hug", "kiss", "pat", "poke", "cry", "wink", "nom", "facepalm", "wave", "blush"];
    if (animeActionCmds.includes(cmd)) {
      const target = args || "everyone";
      const sender = getSenderName(msg);
      const gifCategory = animeCategories[cmd] || cmd;
      try {
        const gifUrl = await getAnimeGif(gifCategory);
        const text = reactionText(cmd, sender, target);
        await sock.sendMessage(jid, { video: { url: gifUrl }, caption: `${text}\n🧩 GAMETECH BOT`, gifPlayback: true });
      } catch {
        const text = reactionText(cmd, sender, target);
        await sock.sendMessage(jid, { text: `${text}\n🧩 GAMETECH BOT` });
      }
      return true;
    }

    if (cmd === "animu" || cmd === "anime") {
      const categories = ["hug", "kiss", "pat", "poke", "cry", "wink", "nom", "facepalm"];
      const cat = randomFrom(categories);
      try {
        const gifUrl = await getAnimeGif(cat);
        await sock.sendMessage(jid, { video: { url: gifUrl }, caption: `✨ Random anime reaction: *${cat}*\n🧩 GAMETECH BOT`, gifPlayback: true });
      } catch {
        await sock.sendMessage(jid, { text: `✨ *Random Anime Reaction: ${cat}*\n\n🧩 GAMETECH BOT` });
      }
      return true;
    }

    // ── Emoji Animations ───────────────────────
    const emojiCmds = ["happy", "heart", "angry", "sad", "shy", "moon", "confused", "hot", "nikal"];
    if (emojiCmds.includes(cmd)) {
      const anim = emojiAnimations[cmd];
      await sock.sendMessage(jid, { text: anim || `${cmd.toUpperCase()}! 🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "emoji") {
      const randomAnim = randomFrom(Object.values(emojiAnimations));
      await sock.sendMessage(jid, { text: randomAnim });
      return true;
    }

    // ══════════════════════════════════════════
    // AUDIO EFFECT COMMANDS
    // ══════════════════════════════════════════

    const audioEffectCmds = Object.keys(audioEffects);
    if (audioEffectCmds.includes(cmd)) {
      try {
        await processAudioEffect(sock, msg, jid, cmd);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Audio effect error: ${e.message}` });
      }
      return true;
    }

    // ══════════════════════════════════════════
    // MEDIA MANIPULATION COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "simage" || cmd === "take" || cmd === "steal") {
      try {
        await stickerToImage(sock, msg, jid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "blur") {
      try {
        await blurImage(sock, msg, jid, args);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Blur error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "toptt") {
      await sock.sendMessage(jid, { text: "⏳ Converting to voice note..." });
      try {
        await toPTT(sock, msg, jid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ PTT error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "tomp3" || cmd === "convert") {
      await sock.sendMessage(jid, { text: "⏳ Converting to MP3..." });
      try {
        await toMp3(sock, msg, jid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Convert error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "tovideo") {
      try {
        await toVideoSticker(sock, msg, jid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Video sticker error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "wasted") {
      try {
        await wastedImage(sock, msg, jid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "wanted") {
      try {
        await wantedImage(sock, msg, jid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "crop") {
      try {
        await cropImage(sock, msg, jid, args);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Crop error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "removebg") {
      await sock.sendMessage(jid, { text: "⏳ Removing background..." });
      try {
        await removeBg(sock, msg, jid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Removebg error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "repackage") {
      try {
        await repackageSticker(sock, msg, jid, args || "GAMETECH BOT", "404 Error");
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Repackage error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "save") {
      try {
        await saveMedia(sock, msg, jid, config.ownerNumberJid);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Save error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "send" || cmd === "sendme") {
      return ownerOnly(async () => {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted) return sock.sendMessage(jid, { text: "↩️ Reply to a message with .sendme" });
        const target = cmd === "sendme" ? config.ownerNumberJid : (args ? args + "@s.whatsapp.net" : jid);
        const { downloadMediaMessage } = require("@whiskeysockets/baileys");
        const q = quoted.quotedMessage;
        if (q?.imageMessage) {
          const key = { ...msg.key, id: quoted.stanzaId };
          const buf = await downloadMediaMessage({ message: q, key }, "buffer", {});
          await sock.sendMessage(target, { image: buf, caption: "Forwarded by GAMETECH BOT" });
        } else if (q?.conversation || q?.extendedTextMessage) {
          const text = q.conversation || q.extendedTextMessage?.text;
          await sock.sendMessage(target, { text });
        }
        await sock.sendMessage(jid, { text: "✅ Sent!" });
      });
    }

    if (cmd === "delete" || cmd === "del") {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      if (!quoted) return sock.sendMessage(jid, { text: "↩️ Reply to a bot message to delete it." });
      try {
        await sock.sendMessage(jid, { delete: { remoteJid: jid, id: quoted.stanzaId, fromMe: true } });
      } catch {
        await sock.sendMessage(jid, { text: "❌ Could not delete that message." });
      }
      return true;
    }

    if (cmd === "pair" || cmd === "code") {
      return ownerOnly(async () => {
        if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}pair <phone number>\nExample: ${prefix}pair 254706478789` });
        try {
          const code = await sock.requestPairingCode(args.replace(/[^0-9]/g, ""));
          await sock.sendMessage(jid, { text: `🔑 *Pairing Code*\n\n${code.match(/.{1,4}/g).join("-")}\n\nEnter this on WhatsApp → Linked Devices\n🧩 GAMETECH BOT` });
        } catch (e) {
          await sock.sendMessage(jid, { text: `❌ Pairing code error: ${e.message}` });
        }
      });
    }

    // ══════════════════════════════════════════
    // EXTENDED GROUP COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "hidetag") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      try {
        await hideTag(sock, jid, args);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "tag" || cmd === "mention") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant || (args ? args.split(" ")[0] + "@s.whatsapp.net" : null);
      if (!target) return sock.sendMessage(jid, { text: `Usage: Reply or ${prefix}tag <number> <message>` });
      const text = args || `Hey @${target.split("@")[0]}!`;
      await sock.sendMessage(jid, { text, mentions: [target] });
      return true;
    }

    if (cmd === "ban") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const target = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(jid, { text: "↩️ Reply to a member's message to ban them." });
      banUser(jid, target);
      await kickMember(sock, jid, target).catch(() => {});
      await sock.sendMessage(jid, { text: `🚫 @${target.split("@")[0]} has been banned from this group.`, mentions: [target] });
      return true;
    }

    if (cmd === "unban") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const target = args ? args + "@s.whatsapp.net" : msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!target) return sock.sendMessage(jid, { text: `Usage: ${prefix}unban <number>` });
      unbanUser(jid, target);
      await sock.sendMessage(jid, { text: `✅ @${target.split("@")[0]} has been unbanned.`, mentions: [target] });
      return true;
    }

    if (cmd === "staff") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      try {
        const staffInfo = await getGroupStaff(sock, jid);
        await sock.sendMessage(jid, staffInfo);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "poll") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}poll Question | Option1 | Option2 | Option3` });
      const parts = args.split("|").map((p) => p.trim());
      if (parts.length < 3) return sock.sendMessage(jid, { text: `❌ Need at least 2 options.\nUsage: ${prefix}poll Question | Option1 | Option2` });
      const question = parts[0];
      const options = parts.slice(1);
      try {
        await createPoll(sock, jid, question, options);
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Poll error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "requestlist") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      try {
        const requests = await getJoinRequests(sock, jid);
        if (!requests.length) return sock.sendMessage(jid, { text: "📋 No pending join requests." });
        const list = requests.map((r) => `• @${r.jid?.split("@")[0] || r}`).join("\n");
        await sock.sendMessage(jid, { text: `📋 *Pending Join Requests (${requests.length})*\n\n${list}\n\n🧩 GAMETECH BOT` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error fetching requests: ${e.message}` });
      }
      return true;
    }

    if (cmd === "acceptall") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      try {
        const count = await processJoinRequests(sock, jid, "approve");
        await sock.sendMessage(jid, { text: `✅ Accepted ${count} join request(s).` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "rejectall") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      try {
        const count = await processJoinRequests(sock, jid, "reject");
        await sock.sendMessage(jid, { text: `✅ Rejected ${count} join request(s).` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "setgpp") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      const quotedImg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message?.imageMessage;
      if (!quotedImg) return sock.sendMessage(jid, { text: "↩️ Send/reply to an image with .setgpp to set it as group photo." });
      try {
        const { downloadMediaMessage } = require("@whiskeysockets/baileys");
        const key = msg.message?.imageMessage ? msg.key : { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId };
        const msgData = msg.message?.imageMessage ? msg.message : msg.message.extendedTextMessage.contextInfo.quotedMessage;
        const buf = await downloadMediaMessage({ message: msgData, key }, "buffer", {});
        await setGroupPP(sock, jid, buf);
        await sock.sendMessage(jid, { text: "✅ Group photo updated!" });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
      }
      return true;
    }

    if (cmd === "setpp") {
      return ownerOnly(async () => {
        const quotedImg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message?.imageMessage;
        if (!quotedImg) return sock.sendMessage(jid, { text: "↩️ Send/reply to an image with .setpp" });
        try {
          const { downloadMediaMessage } = require("@whiskeysockets/baileys");
          const key = msg.message?.imageMessage ? msg.key : { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId };
          const msgData = msg.message?.imageMessage ? msg.message : msg.message.extendedTextMessage.contextInfo.quotedMessage;
          const buf = await downloadMediaMessage({ message: msgData, key }, "buffer", {});
          await sock.updateProfilePicture(sock.user.id, buf);
          await sock.sendMessage(jid, { text: "✅ Bot profile picture updated!" });
        } catch (e) {
          await sock.sendMessage(jid, { text: `❌ Error: ${e.message}` });
        }
      });
    }

    if (cmd === "clear") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      return ownerOnly(async () => {
        await sock.sendMessage(jid, { text: "🗑️ *Group Cleared by Admin*\n🧩 GAMETECH BOT" });
      });
    }

    if (cmd === "announce") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}announce <message>` });
      const meta = await sock.groupMetadata(jid);
      const mentions = meta.participants.map((m) => m.id);
      await sock.sendMessage(jid, {
        text: `📢 *ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━\n\n${args}\n\n━━━━━━━━━━━━━━━━\n🧩 GAMETECH BOT`,
        mentions,
      });
      return true;
    }

    if (cmd === "join") {
      return ownerOnly(async () => {
        if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}join <group invite link>` });
        try {
          await joinGroup(sock, args);
          await sock.sendMessage(jid, { text: "✅ Joined the group!" });
        } catch (e) {
          await sock.sendMessage(jid, { text: `❌ Join failed: ${e.message}` });
        }
      });
    }

    if (cmd === "leave") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      return ownerOnly(async () => {
        await sock.sendMessage(jid, { text: "👋 Bye bye! GAMETECH BOT is leaving this group.\n🧩 GAMETECH BOT" });
        await sleep(2000);
        await leaveGroup(sock, jid).catch(() => {});
      });
    }

    if (cmd === "newgc") {
      return ownerOnly(async () => {
        if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}newgc <group name>` });
        try {
          const result = await createGroup(sock, args, [config.ownerNumberJid]);
          await sock.sendMessage(jid, { text: `✅ Created group: *${args}*\n🆔 ${result.id}` });
        } catch (e) {
          await sock.sendMessage(jid, { text: `❌ Group creation failed: ${e.message}` });
        }
      });
    }

    if (cmd === "online" || cmd === "whosonline") {
      if (!group) return sock.sendMessage(jid, { text: "❌ Group only." });
      await sock.sendMessage(jid, { text: `👁️ *Online Members*\n\n⚠️ WhatsApp doesn't expose real-time online status for privacy.\n\nUse ${prefix}groupinfo to see member list.\n🧩 GAMETECH BOT` });
      return true;
    }

    if (cmd === "rank") {
      const sender = getSenderName(msg);
      const ranks = ["🌟 Newbie", "⭐ Regular", "💫 Active", "🔥 Legend", "👑 Elite", "💎 God Mode"];
      const rank = randomFrom(ranks);
      await sock.sendMessage(jid, { text: `🏆 *RANK SYSTEM*\n\n👤 ${sender}\n🎖️ Rank: ${rank}\n\n🧩 GAMETECH BOT` });
      return true;
    }

    // ══════════════════════════════════════════
    // OWNER EXTRA COMMANDS
    // ══════════════════════════════════════════

    if (cmd === "clearsession") {
      return ownerOnly(async () => {
        const fs = require("fs-extra");
        await sock.sendMessage(jid, { text: "⚠️ This will log out the bot. Are you sure?\n\nType *.clearsession confirm* to proceed." });
        if (args === "confirm") {
          await fs.emptyDir(config.sessionDir).catch(() => {});
          await sock.sendMessage(jid, { text: "🗑️ Session cleared. Bot will need to be re-linked." });
          process.exit(0);
        }
      });
    }

    if (cmd === "autoreply") {
      return ownerOnly(async () => {
        if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}autoreply <message> or ${prefix}autoreply off` });
        if (args === "off") {
          await settings.set("autoReplyMsg", "");
          return sock.sendMessage(jid, { text: "✅ Auto-reply disabled." });
        }
        await settings.set("autoReplyMsg", args);
        await sock.sendMessage(jid, { text: `✅ Auto-reply set to:\n_${args}_` });
      });
    }

    if (cmd === "sudo") {
      return ownerOnly(async () => {
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant || (args ? args + "@s.whatsapp.net" : null);
        if (!target) return sock.sendMessage(jid, { text: `Usage: Reply to a message or ${prefix}sudo <number>` });
        const current = settings.get("sudoUsers") || [];
        if (!current.includes(target)) {
          await settings.set("sudoUsers", [...current, target]);
          await sock.sendMessage(jid, { text: `✅ @${target.split("@")[0]} added as sudo user.`, mentions: [target] });
        } else {
          await settings.set("sudoUsers", current.filter((u) => u !== target));
          await sock.sendMessage(jid, { text: `✅ @${target.split("@")[0]} removed from sudo.`, mentions: [target] });
        }
      });
    }

    if (cmd === "notes") {
      return ownerOnly(async () => {
        const notesFile = "./sessions/notes.json";
        const fs = require("fs-extra");
        const notes = await fs.readJSON(notesFile).catch(() => ({}));
        if (!args) {
          const list = Object.keys(notes);
          if (!list.length) return sock.sendMessage(jid, { text: "📝 No notes saved. Use: .notes save <name> <text>" });
          return sock.sendMessage(jid, { text: `📝 *Saved Notes*\n\n${list.map((k) => `• ${k}`).join("\n")}\n\nUse: .notes get <name>` });
        }
        const [action, name, ...rest] = args.split(" ");
        const text = rest.join(" ");
        if (action === "save" && name && text) {
          notes[name] = text;
          await fs.outputJSON(notesFile, notes);
          return sock.sendMessage(jid, { text: `✅ Note *${name}* saved.` });
        }
        if (action === "get" && name) {
          const note = notes[name];
          return sock.sendMessage(jid, { text: note ? `📝 *${name}*\n\n${note}` : `❌ Note *${name}* not found.` });
        }
        if (action === "delete" && name) {
          delete notes[name];
          await fs.outputJSON(notesFile, notes);
          return sock.sendMessage(jid, { text: `🗑️ Note *${name}* deleted.` });
        }
        return sock.sendMessage(jid, { text: `📝 *Notes Commands:*\n.notes save <name> <text>\n.notes get <name>\n.notes delete <name>` });
      });
    }

    if (cmd === "bothosting") {
      await sock.sendMessage(jid, {
        text: `🖥️ *Bot Hosting Info*\n\n` +
          `☁️ Platform: Replit VM\n` +
          `⚡ Runtime: Node.js ${process.version}\n` +
          `💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used\n` +
          `⏱️ Uptime: ${formatUptime(Date.now() - START_TIME)}\n` +
          `📦 Bot Version: ${config.botVersion}\n\n` +
          `🧩 GAMETECH BOT by 404 Error`,
      });
      return true;
    }

    if (cmd === "autotext" || cmd === "autosticker") {
      return ownerOnly(async () => {
        const key = cmd === "autosticker" ? "autoSticker" : "autoText";
        const newVal = await settings.toggle(key);
        await sock.sendMessage(jid, { text: `${newVal ? "✅" : "❌"} *${cmd}* turned ${newVal ? "ON" : "OFF"}` });
      });
    }

    if (cmd === "post" || cmd === "repost") {
      return ownerOnly(async () => {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted) {
          if (args) {
            await sock.sendMessage("status@broadcast", { text: args });
            return sock.sendMessage(jid, { text: "✅ Posted to status!" });
          }
          return sock.sendMessage(jid, { text: `Usage: Reply to media with ${prefix}post, or ${prefix}post <text>` });
        }
        const { downloadMediaMessage } = require("@whiskeysockets/baileys");
        const q = quoted.quotedMessage;
        const key2 = { ...msg.key, id: quoted.stanzaId };
        if (q?.imageMessage) {
          const buf = await downloadMediaMessage({ message: q, key: key2 }, "buffer", {});
          await sock.sendMessage("status@broadcast", { image: buf, caption: args || "" });
          await sock.sendMessage(jid, { text: "✅ Image posted to status!" });
        } else if (q?.videoMessage) {
          const buf = await downloadMediaMessage({ message: q, key: key2 }, "buffer", {});
          await sock.sendMessage("status@broadcast", { video: buf, caption: args || "" });
          await sock.sendMessage(jid, { text: "✅ Video posted to status!" });
        }
      });
    }

    // ── Weather (free, no API key needed) ─────────
    if (cmd === "weather") {
      if (!args) return sock.sendMessage(jid, { text: `Usage: ${prefix}weather <city>` });
      try {
        const axios = require("axios");
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(args)}?format=j1`);
        const d = res.data;
        const current = d.current_condition[0];
        const area = d.nearest_area[0];
        const city = area.areaName[0].value + ", " + area.country[0].value;
        await sock.sendMessage(jid, {
          text: `🌤️ *Weather in ${city}*\n\n` +
            `🌡️ Temp: ${current.temp_C}°C (feels ${current.FeelsLikeC}°C)\n` +
            `💧 Humidity: ${current.humidity}%\n` +
            `🌬️ Wind: ${current.windspeedKmph} km/h ${current.winddir16Point}\n` +
            `☁️ ${current.weatherDesc[0].value}\n` +
            `👀 Visibility: ${current.visibility} km\n\n🧩 GAMETECH BOT`,
        });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ Weather error: ${e.message}` });
      }
      return true;
    }

    // Unknown command
    return false;
  } catch (err) {
    console.error("[CommandRouter]", err.message);
    return false;
  }
}

module.exports = { handleCommand };

// ╔══════════════════════════════════════════════╗
// ║   GAMETECH BOT - Self-Chat Forwarder         ║
// ║   Forwards messages, view-once & deleted     ║
// ║   messages to the owner's own chat (saved    ║
// ║   messages / "Message Yourself")             ║
// ╚══════════════════════════════════════════════╝

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const config = require("../config");
const settings = require("../utils/settings");

// In-memory store: msgId → full message object (for anti-delete)
const msgStore = new Map();

// ── Helper: owner's self-chat JID ──────────────
// WhatsApp "saved messages" / self-chat is just
// the owner's own number JID.
function selfJid(sock) {
  const raw = sock.user?.id || config.ownerNumberJid;
  const num = raw.split(":")[0].split("@")[0];
  return num + "@s.whatsapp.net";
}

// ── Helper: extract readable text from any msg ─
function extractText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.audioMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.stickerMessage ? "[Sticker]" :
    message?.locationMessage ? `📍 Location: ${message.locationMessage.degreesLatitude}, ${message.locationMessage.degreesLongitude}` :
    message?.contactMessage ? `👤 Contact: ${message.contactMessage.displayName}` :
    null
  );
}

// ── Helper: get media type from message ────────
function getMediaType(message) {
  if (message?.imageMessage)    return "image";
  if (message?.videoMessage)    return "video";
  if (message?.audioMessage)    return "audio";
  if (message?.documentMessage) return "document";
  if (message?.stickerMessage)  return "sticker";
  return null;
}

// ══════════════════════════════════════════════
// 1. STORE every incoming message for anti-delete
// ══════════════════════════════════════════════
function storeMessage(msg) {
  if (!msg?.key?.id || !msg.message) return;
  msgStore.set(msg.key.id, msg);
  // Keep store lean — cap at 2000 messages
  if (msgStore.size > 2000) {
    const firstKey = msgStore.keys().next().value;
    msgStore.delete(firstKey);
  }
}

// ══════════════════════════════════════════════
// 2. FORWARD a regular message to self-chat
//    Called on every incoming message when
//    selfChatForward setting is ON
// ══════════════════════════════════════════════
async function forwardToSelf(sock, msg) {
  if (!settings.get("selfChatForward")) return;

  const from    = selfJid(sock);
  const target  = from; // owner's self-chat
  const sender  = msg.pushName || msg.key?.participant?.split("@")[0] || msg.key?.remoteJid?.split("@")[0] || "Unknown";
  const chatJid = msg.key?.remoteJid || "";
  const isGroup = chatJid.endsWith("@g.us");

  const header = isGroup
    ? `📩 *[Group Message]*\n👤 From: ${sender}\n💬 Chat: ${chatJid.replace("@g.us", "")}\n─────────────────`
    : `📩 *[DM Message]*\n👤 From: ${sender}\n─────────────────`;

  try {
    const text = extractText(msg.message);
    const mediaType = getMediaType(msg.message);

    if (text && !mediaType) {
      // Plain text
      await sock.sendMessage(target, {
        text: `${header}\n${text}\n🧩 GAMETECH BOT`,
      });
      return;
    }

    if (mediaType) {
      // Download and re-send the media
      const buf = await downloadMediaMessage(msg, "buffer", {}).catch(() => null);
      if (!buf) {
        await sock.sendMessage(target, {
          text: `${header}\n[${mediaType.toUpperCase()} — could not download]\n🧩 GAMETECH BOT`,
        });
        return;
      }

      const caption = `${header}\n${text || ""}\n🧩 GAMETECH BOT`.trim();

      if (mediaType === "image") {
        await sock.sendMessage(target, { image: buf, caption });
      } else if (mediaType === "video") {
        await sock.sendMessage(target, { video: buf, caption });
      } else if (mediaType === "audio") {
        await sock.sendMessage(target, { audio: buf, mimetype: "audio/mp4" });
        if (header) await sock.sendMessage(target, { text: caption });
      } else if (mediaType === "sticker") {
        await sock.sendMessage(target, { sticker: buf });
        await sock.sendMessage(target, { text: `${header}\n[Sticker]\n🧩 GAMETECH BOT` });
      } else if (mediaType === "document") {
        const fname = msg.message?.documentMessage?.fileName || "file";
        const mime  = msg.message?.documentMessage?.mimetype || "application/octet-stream";
        await sock.sendMessage(target, { document: buf, fileName: fname, mimetype: mime, caption });
      }
    }
  } catch (e) {
    console.error("[SelfChat] forwardToSelf error:", e.message);
  }
}

// ══════════════════════════════════════════════
// 3. FORWARD view-once media to self-chat
//    Called automatically when a view-once msg
//    arrives (bypasses the one-time limit)
// ══════════════════════════════════════════════
async function forwardViewOnceToSelf(sock, msg) {
  if (!settings.get("selfChatForward")) return;

  const target = selfJid(sock);
  const sender = msg.pushName || msg.key?.participant?.split("@")[0] || "Unknown";

  // Unwrap view-once envelope
  const inner =
    msg.message?.viewOnceMessage?.message ||
    msg.message?.viewOnceMessageV2?.message ||
    msg.message?.viewOnceMessageV2Extension?.message ||
    null;

  if (!inner) return;

  const mediaType = getMediaType(inner);
  const header = `👁️ *[View-Once Message]*\n👤 From: ${sender}\n─────────────────`;

  try {
    const fakeMsg = { key: msg.key, message: inner };
    const buf = await downloadMediaMessage(fakeMsg, "buffer", {}).catch(() => null);

    if (!buf) {
      await sock.sendMessage(target, {
        text: `${header}\n[View-once media — download failed]\n🧩 GAMETECH BOT`,
      });
      return;
    }

    const caption = `${header}\n[View-once ${mediaType || "media"} — saved automatically]\n🧩 GAMETECH BOT`;

    if (mediaType === "image") {
      await sock.sendMessage(target, { image: buf, caption });
    } else if (mediaType === "video") {
      await sock.sendMessage(target, { video: buf, caption });
    } else if (mediaType === "audio") {
      await sock.sendMessage(target, { audio: buf, mimetype: "audio/mp4" });
      await sock.sendMessage(target, { text: caption });
    } else {
      await sock.sendMessage(target, { text: `${header}\n[Unsupported view-once type]\n🧩 GAMETECH BOT` });
    }
  } catch (e) {
    console.error("[SelfChat] forwardViewOnceToSelf error:", e.message);
  }
}

// ══════════════════════════════════════════════
// 4. RECOVER and forward deleted messages
//    Called from messages.update event when
//    messageStubType signals a deletion
// ══════════════════════════════════════════════
async function forwardDeletedToSelf(sock, updates) {
  if (!settings.get("selfChatForward") && !settings.get("antiDelete")) return;

  const target = selfJid(sock);

  for (const update of updates) {
    const stubType = update.update?.messageStubType;
    // 68 = message deleted for everyone; also catch 73 / others
    if (!stubType) continue;

    const msgId = update.key?.id;
    const stored = msgId ? msgStore.get(msgId) : null;

    const chatJid = update.key?.remoteJid || "";
    const isGroup = chatJid.endsWith("@g.us");
    const senderNum = update.key?.participant?.split("@")[0] ||
                      update.key?.remoteJid?.split("@")[0] || "Unknown";

    const header = `🗑️ *[Deleted Message Recovered]*\n👤 From: ${senderNum}\n${isGroup ? `💬 Group: ${chatJid.replace("@g.us", "")}\n` : ""}─────────────────`;

    try {
      if (!stored) {
        // We have the deletion event but not the original message
        await sock.sendMessage(target, {
          text: `${header}\n⚠️ Message was deleted before it could be stored.\n🧩 GAMETECH BOT`,
        });
        continue;
      }

      const text = extractText(stored.message);
      const mediaType = getMediaType(stored.message);

      if (text && !mediaType) {
        await sock.sendMessage(target, {
          text: `${header}\n${text}\n🧩 GAMETECH BOT`,
        });
      } else if (mediaType) {
        const buf = await downloadMediaMessage(stored, "buffer", {}).catch(() => null);
        const caption = `${header}\n${text || ""}\n🧩 GAMETECH BOT`.trim();

        if (!buf) {
          await sock.sendMessage(target, {
            text: `${header}\n[${mediaType.toUpperCase()} — media could not be recovered]\n🧩 GAMETECH BOT`,
          });
          continue;
        }

        if (mediaType === "image")    await sock.sendMessage(target, { image: buf, caption });
        else if (mediaType === "video")    await sock.sendMessage(target, { video: buf, caption });
        else if (mediaType === "audio") {
          await sock.sendMessage(target, { audio: buf, mimetype: "audio/mp4" });
          await sock.sendMessage(target, { text: caption });
        } else if (mediaType === "sticker") {
          await sock.sendMessage(target, { sticker: buf });
          await sock.sendMessage(target, { text: caption });
        } else if (mediaType === "document") {
          const fname = stored.message?.documentMessage?.fileName || "file";
          const mime  = stored.message?.documentMessage?.mimetype || "application/octet-stream";
          await sock.sendMessage(target, { document: buf, fileName: fname, mimetype: mime, caption });
        }
      } else {
        await sock.sendMessage(target, {
          text: `${header}\n[Unsupported or empty message type]\n🧩 GAMETECH BOT`,
        });
      }
    } catch (e) {
      console.error("[SelfChat] forwardDeletedToSelf error:", e.message);
    }
  }
}

module.exports = {
  storeMessage,
  forwardToSelf,
  forwardViewOnceToSelf,
  forwardDeletedToSelf,
};

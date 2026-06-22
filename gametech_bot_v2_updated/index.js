// ╔══════════════════════════════════════════════╗
// ║   GAMETECH BOT v2.0 — Multi-Session Engine   ║
// ║   Creator: 404 Error "GAMETECH"              ║
// ╚══════════════════════════════════════════════╝

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const pino       = require("pino");
const fs         = require("fs-extra");
const path       = require("path");
const NodeCache  = require("node-cache");
const cron       = require("node-cron");
const chalk      = require("chalk");

const config        = require("./src/config");
const settings      = require("./src/utils/settings");
const { handleCommand }              = require("./src/handlers/commandRouter");
const { handleStatus }               = require("./src/handlers/statusHandler");
const { storeMessage, handleDelete } = require("./src/handlers/antiDelete");
const { handleViewOnce }             = require("./src/handlers/viewOnce");
const {
  storeMessage:        scStore,
  forwardToSelf,
  forwardViewOnceToSelf,
  forwardDeletedToSelf,
}                                    = require("./src/handlers/selfChat");
const { formatUptime, randomFrom, sleep } = require("./src/utils/helpers");
const { sessionMap }                 = require("./src/utils/sessionStore");

// ── Ensure dirs ───────────────────────────────
fs.ensureDirSync(config.tempDir);
fs.ensureDirSync(config.sessionDir);
fs.ensureDirSync("./assets");

const START_TIME      = Date.now();
const msgRetryCache   = new NodeCache();
const SESSIONS_FILE   = path.join(config.sessionDir, "sessions.json");

let io = null;  // set by startWebPanel()
let bioIndex = 0;

// ══════════════════════════════════════════════
// SESSION PERSISTENCE
// ══════════════════════════════════════════════

async function loadSessionIds() {
  try {
    if (await fs.pathExists(SESSIONS_FILE)) return await fs.readJson(SESSIONS_FILE);
  } catch {}
  return [];
}

async function saveSessionIds() {
  const ids = [...sessionMap.keys()];
  await fs.outputJson(SESSIONS_FILE, ids);
}

// ══════════════════════════════════════════════
// MIGRATION: old single-session → multi-session
// Moves ./sessions/creds.json  →  ./sessions/default/creds.json
// ══════════════════════════════════════════════

async function migrateDefaultSession() {
  const oldCreds = path.join(config.sessionDir, "creds.json");
  const newDir   = path.join(config.sessionDir, "default");

  if (
    (await fs.pathExists(oldCreds)) &&
    !(await fs.pathExists(path.join(newDir, "creds.json")))
  ) {
    await fs.ensureDir(newDir);
    const files = await fs.readdir(config.sessionDir);
    for (const file of files) {
      if (file.endsWith(".json") && !["settings.json", "sessions.json"].includes(file)) {
        try {
          await fs.move(
            path.join(config.sessionDir, file),
            path.join(newDir, file),
            { overwrite: true }
          );
        } catch {}
      }
    }
    console.log(chalk.cyan("[Migration] Moved existing session → sessions/default/"));
  }

  // Create sessions.json if missing
  if (!(await fs.pathExists(SESSIONS_FILE))) {
    const defaultExists = await fs.pathExists(path.join(newDir, "creds.json"));
    await fs.outputJson(SESSIONS_FILE, defaultExists ? ["default"] : []);
  }
}

// ══════════════════════════════════════════════
// REAL-TIME EMITTERS
// ══════════════════════════════════════════════

function emitSessionUpdate(session) {
  if (!io) return;
  io.emit("session:update", {
    id: session.id,
    status: session.status,
    user: session.user,
  });
}

function emitSessionsList() {
  if (!io) return;
  const list = [...sessionMap.values()].map((s) => ({
    id: s.id,
    status: s.status,
    user: s.user,
  }));
  io.emit("sessions:list", list);
}

// ══════════════════════════════════════════════
// START A SINGLE SESSION
// ══════════════════════════════════════════════

async function startSession(sessionId) {
  // Avoid double-starting an already open session
  if (sessionMap.get(sessionId)?.status === "open") return;

  const sessionDir = path.join(config.sessionDir, sessionId);
  await fs.ensureDir(sessionDir);

  const session = {
    id: sessionId,
    sock: null,
    qr: null,
    status: "connecting",
    user: null,
    reconnectCount: 0,
  };

  sessionMap.set(sessionId, session);
  emitSessionUpdate(session);
  emitSessionsList();

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    msgRetryCounterCache: msgRetryCache,
    generateHighQualityLinkPreview: true,
    browser: ["GAMETECH BOT", "Chrome", "110.0.0"],
    syncFullHistory: false,
    markOnlineOnConnect: settings.get("alwaysOnline"),
  });

  session.sock = sock;
  sock.ev.on("creds.update", saveCreds);

  // ── Connection state ──────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qr     = qr;
      session.status = "qr";
      emitSessionUpdate(session);

      // Send rendered QR to web panel
      try {
        const QRCode  = require("qrcode");
        const dataUrl = await QRCode.toDataURL(qr);
        if (io) io.emit("session:qr", { id: sessionId, qr: dataUrl });
      } catch {}

      const QRTerm = require("qrcode-terminal");
      QRTerm.generate(qr, { small: true });
      console.log(chalk.yellow(`\n[${sessionId}] Scan QR above (or use web panel)\n`));
    }

    if (connection === "open") {
      session.qr             = null;
      session.status         = "open";
      session.user           = { name: sock.user?.name, id: sock.user?.id };
      session.reconnectCount = 0;
      session.connectedAt    = Date.now();

      console.log(chalk.green(`✅ [${sessionId}] Connected as ${sock.user?.name} (${sock.user?.id})`));
      emitSessionUpdate(session);
      emitSessionsList();

      // Notify owner
      try {
        await sock.sendMessage(config.ownerNumberJid, {
          text:
            `🟢 *GAMETECH BOT ONLINE*\n\n` +
            `✅ Session: *${sessionId}*\n` +
            `📱 Account: ${sock.user?.name}\n` +
            `⏰ ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}\n\n` +
            `Type *.menu* to see all commands\n🧩 GAMETECH BOT`,
        });
      } catch {}

      // ── Auto-add connected account to owner's group ──
      if (settings.get("autoAddToGroup")) {
        const rawId  = sock.user?.id || "";
        const newJid = rawId.split(":")[0].split("@")[0] + "@s.whatsapp.net";

        if (newJid && newJid !== "@s.whatsapp.net") {
          const groupJid   = settings.get("ownerGroupJid") || config.ownerGroupJid || "";
          const inviteLink = settings.get("ownerGroupLink") || config.groupLink || "";
          const inviteCode = inviteLink.split("chat.whatsapp.com/")[1]?.split(/[?&]/)[0] || "";

          let added = false;

          // Strategy 1: admin-add via default session (requires bot to be group admin)
          if (groupJid) {
            const defaultSession = sessionMap.get("default");
            const adderSock = (sessionId !== "default" && defaultSession?.status === "open" && defaultSession?.sock)
              ? defaultSession.sock
              : sock;
            try {
              await adderSock.groupParticipantsUpdate(groupJid, [newJid], "add");
              console.log(chalk.green(`✅ [${sessionId}] Auto-added ${newJid} to group`));
              added = true;
            } catch (e) {
              console.log(chalk.yellow(`⚠️  [${sessionId}] Admin-add failed (${e.message}), trying invite link…`));
            }
          }

          // Strategy 2: join via invite link (always available as fallback)
          if (!added && inviteCode) {
            try {
              await sock.groupAcceptInvite(inviteCode);
              console.log(chalk.green(`✅ [${sessionId}] Joined group via invite link`));
              added = true;
            } catch (e) {
              console.log(chalk.red(`❌ [${sessionId}] Join via invite failed: ${e.message}`));
            }
          }

          // Notify owner
          if (added) {
            try {
              await sock.sendMessage(config.ownerNumberJid, {
                text:
                  `👥 *Auto-Added to Group*\n\n` +
                  `📱 Account: ${sock.user?.name}\n` +
                  `🔢 Number: +${newJid.split("@")[0]}\n` +
                  `✅ Joined your group successfully!\n🧩 GAMETECH BOT`,
              });
            } catch {}
          }
        }
      }

      startBackgroundTasks(session);
      await saveSessionIds();
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut  = statusCode === DisconnectReason.loggedOut;

      session.status = "close";
      session.qr     = null;
      session.user   = null;
      emitSessionUpdate(session);
      emitSessionsList();
      console.log(chalk.red(`⚠️  [${sessionId}] Disconnected. Code: ${statusCode}`));

      if (loggedOut) {
        console.log(chalk.red(`❌ [${sessionId}] Logged out. Removing session.`));
        try { await fs.remove(sessionDir); } catch {}
        sessionMap.delete(sessionId);
        await saveSessionIds();
        if (io) io.emit("session:removed", { id: sessionId });
        emitSessionsList();
      } else if (session.reconnectCount < 10) {
        session.reconnectCount++;
        const delay = Math.min(5000 * session.reconnectCount, 30000);
        console.log(chalk.yellow(`🔄 [${sessionId}] Reconnecting in ${delay / 1000}s (attempt ${session.reconnectCount})`));
        setTimeout(() => startSession(sessionId), delay);
      } else {
        console.log(chalk.red(`❌ [${sessionId}] Max reconnect attempts reached.`));
      }
    }
  });

  // ── Messages ──────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe && !config.allowSelfCommands) continue;

      const jid = msg.key.remoteJid;

      if (jid === "status@broadcast") {
        await handleStatus(sock, msg);
        continue;
      }

      storeMessage(msg);
      scStore(msg); // self-chat store for deleted-message recovery

      // ── Forward to self-chat (if enabled) ────
      if (!msg.key.fromMe && jid !== "status@broadcast") {
        forwardToSelf(sock, msg).catch(() => {});
      }

      if (settings.get("autoRead"))
        await sock.readMessages([msg.key]).catch(() => {});

      if (settings.get("autoReact") && !msg.key.fromMe) {
        const emoji = randomFrom(config.reactions);
        await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }).catch(() => {});
      }

      if (settings.get("autoTyping") && !msg.key.fromMe) {
        await sock.sendPresenceUpdate("composing", jid).catch(() => {});
        await sleep(2000);
        await sock.sendPresenceUpdate("paused", jid).catch(() => {});
      }

      if (settings.get("autoRecording") && !msg.key.fromMe) {
        await sock.sendPresenceUpdate("recording", jid).catch(() => {});
        await sleep(2000);
        await sock.sendPresenceUpdate("paused", jid).catch(() => {});
      }

      if (settings.get("chatbot") && !msg.key.fromMe) {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        if (text && !text.startsWith(config.prefix)) {
          try {
            const { askFreeAI } = require("./src/commands/ai");
            const reply = await askFreeAI(text);
            await sock.sendMessage(jid, { text: reply, quoted: msg });
          } catch {}
        }
      }

      // Anti-ban random delay before command processing
      const bodyCheck =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption || "";
      if (bodyCheck.startsWith(config.prefix)) {
        await sleep(300 + Math.floor(Math.random() * 700));
      }

      await handleCommand(sock, msg).catch((e) =>
        console.error(`[CMD Error][${sessionId}]`, e.message)
      );
    }
  });

  // ── Anti-delete ────────────────────────────
  sock.ev.on("messages.update", async (updates) => {
    // Forward deleted messages to self-chat
    forwardDeletedToSelf(sock, updates).catch(() => {});

    if (!settings.get("antiDelete")) return;
    for (const update of updates) {
      if (update.update?.messageStubType) {
        await handleDelete(sock, [update], config.ownerNumberJid).catch(() => {});
      }
    }
  });

  // ── View-once bypass ──────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2) {
        await handleViewOnce(sock, msg).catch(() => {});
        // Also forward view-once to self-chat
        forwardViewOnceToSelf(sock, msg).catch(() => {});
      }
    }
  });

  // ── Group events (welcome / goodbye) ──────
  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    for (const p of participants) {
      try {
        if (action === "add" && settings.get("welcome")) {
          await sock.sendMessage(id, {
            text: `👋 Welcome @${p.split("@")[0]}!\n\nThis group uses 🧩 GAMETECH BOT\nType *.menu* for commands!`,
            mentions: [p],
          });
        } else if (action === "remove" && settings.get("goodbye")) {
          await sock.sendMessage(id, {
            text: `👋 Goodbye @${p.split("@")[0]}!\nSee you around 🧩 GAMETECH BOT`,
            mentions: [p],
          });
        }
      } catch {}
    }
  });

  // ── Anti-call ─────────────────────────────
  sock.ev.on("call", async (calls) => {
    if (!settings.get("antiCall")) return;
    for (const call of calls) {
      if (call.status === "offer") {
        try {
          await sock.rejectCall(call.id, call.from);
          await sock.sendMessage(call.from, {
            text: `❌ Calls are not accepted.\nUse *.menu* for commands.\n🧩 GAMETECH BOT`,
          });
        } catch {}
      }
    }
  });
}

// ══════════════════════════════════════════════
// BACKGROUND TASKS
// ══════════════════════════════════════════════

function startBackgroundTasks(session) {
  const { sock } = session;
  setInterval(async () => {
    if (!settings.get("alwaysOnline")) return;
    await sock.sendPresenceUpdate("available").catch(() => {});
  }, 30000);
}

// Auto-bio — rotates across all open sessions
cron.schedule("0 */2 * * *", async () => {
  if (!settings.get("autoBio")) return;
  const bio = config.autoBioMessages[bioIndex % config.autoBioMessages.length];
  bioIndex++;
  for (const s of sessionMap.values()) {
    if (s.status === "open" && s.sock) {
      try { await s.sock.updateProfileStatus(bio); } catch {}
    }
  }
});

// Temp cleanup every 6 hours
cron.schedule("0 */6 * * *", async () => {
  const { clearTemp } = require("./src/utils/helpers");
  const n = await clearTemp();
  if (n > 0) console.log(chalk.gray(`[Cron] Cleared ${n} temp files`));
});

// ══════════════════════════════════════════════
// STOP / REMOVE A SESSION
// ══════════════════════════════════════════════

async function stopSession(sessionId, deleteFiles = false) {
  const session = sessionMap.get(sessionId);
  if (!session) return;
  try { session.sock?.end(); } catch {}
  session.status = "stopped";
  if (deleteFiles) {
    const dir = path.join(config.sessionDir, sessionId);
    await fs.remove(dir).catch(() => {});
    sessionMap.delete(sessionId);
    await saveSessionIds();
    if (io) io.emit("session:removed", { id: sessionId });
  }
  emitSessionsList();
}

// ══════════════════════════════════════════════
// LOAD ALL SAVED SESSIONS ON BOOT
// ══════════════════════════════════════════════

async function loadAllSessions() {
  const ids = await loadSessionIds();

  if (ids.length === 0) {
    console.log(chalk.cyan("[Sessions] No sessions found — starting default session..."));
    await startSession("default");
    return;
  }

  console.log(chalk.cyan(`[Sessions] Loading ${ids.length} session(s)...`));
  for (let i = 0; i < ids.length; i++) {
    if (i > 0) await sleep(2000); // stagger to avoid hammering WA servers
    startSession(ids[i]).catch((e) =>
      console.error(`[Sessions] Failed to start "${ids[i]}":`, e.message)
    );
  }
}

// ══════════════════════════════════════════════
// WEB PANEL
// ══════════════════════════════════════════════

function startWebPanel() {
  const express = require("express");
  const { Server } = require("socket.io");
  const http   = require("http");
  const QRCode = require("qrcode");

  const app    = express();
  const server = http.createServer(app);
  io = new Server(server);

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "web")));

  app.get("/", (req, res) => res.sendFile(path.join(__dirname, "web", "index.html")));

  // List all sessions
  app.get("/sessions", (req, res) => {
    res.json(
      [...sessionMap.values()].map((s) => ({ id: s.id, status: s.status, user: s.user }))
    );
  });

  // Add new session
  app.post("/sessions", async (req, res) => {
    const existing = [...sessionMap.keys()];
    let num = existing.length + 1;
    let newId;
    do { newId = `bot_${num++}`; } while (sessionMap.has(newId));
    try {
      await startSession(newId);
      res.json({ id: newId, status: "connecting" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove a session
  app.delete("/sessions/:id", async (req, res) => {
    const { id } = req.params;
    if (!sessionMap.has(id)) return res.status(404).json({ error: "Session not found" });
    try {
      await stopSession(id, true);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pairing code for a session
  app.post("/sessions/:id/pair", async (req, res) => {
    const { id }    = req.params;
    const { phone } = req.body;
    const session   = sessionMap.get(id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!session.sock?.requestPairingCode)
      return res.status(400).json({ error: "Session not ready for pairing yet" });
    try {
      const code = await session.sock.requestPairingCode(phone.replace(/[^0-9]/g, ""));
      res.json({ code: code.match(/.{1,4}/g).join("-") });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // General status
  app.get("/status", (req, res) => {
    const connected = [...sessionMap.values()].filter((s) => s.status === "open").length;
    res.json({
      connected,
      total: sessionMap.size,
      uptime: formatUptime(Date.now() - START_TIME),
    });
  });

  // Socket.IO
  io.on("connection", async (socket) => {
    // Send full list
    socket.emit(
      "sessions:list",
      [...sessionMap.values()].map((s) => ({ id: s.id, status: s.status, user: s.user }))
    );
    // Send pending QRs
    for (const [id, s] of sessionMap) {
      if (s.qr && s.status === "qr") {
        try {
          const url = await QRCode.toDataURL(s.qr);
          socket.emit("session:qr", { id, qr: url });
        } catch {}
      }
    }
  });

  // Periodic tick for uptime
  setInterval(() => {
    if (!io) return;
    const connected = [...sessionMap.values()].filter((s) => s.status === "open").length;
    io.emit("status:tick", {
      uptime: formatUptime(Date.now() - START_TIME),
      connected,
      total: sessionMap.size,
    });
  }, 3000);

  server.listen(3000, () =>
    console.log(chalk.cyan("🌐 Web Panel: http://localhost:3000\n"))
  );
}

// ══════════════════════════════════════════════
// BOOT SEQUENCE
// ══════════════════════════════════════════════

console.log(chalk.green(`\n╔══════════════════════════════════╗`));
console.log(chalk.green(`║  🧩 GAMETECH BOT v${config.botVersion} (Multi)  ║`));
console.log(chalk.green(`║  Creator: 404 Error GAMETECH      ║`));
console.log(chalk.green(`║  Owner: ${config.ownerName}          ║`));
console.log(chalk.green(`╚══════════════════════════════════╝\n`));

startWebPanel();

(async () => {
  await settings.load();
  await migrateDefaultSession();
  await loadAllSessions();
})();

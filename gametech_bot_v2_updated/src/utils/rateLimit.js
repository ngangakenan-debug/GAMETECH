// ╔══════════════════════════════════════════════╗
// ║     GAMETECH BOT - Per-User Rate Limiter     ║
// ╚══════════════════════════════════════════════╝

// Tracks: { jid → { count, windowStart, warned } }
const userBuckets = new Map();
// Tracks: { jid → { count, windowStart } } for bot outgoing messages
const outgoingBuckets = new Map();

const WINDOW_MS = 60_000;          // 1-minute sliding window
const MAX_COMMANDS_PER_USER = 15;  // max commands a single user can send per minute
const MAX_OUTGOING_PER_MIN = 25;   // max messages bot sends per minute total
const COOLDOWN_HEAVY = 10_000;     // 10-second cooldown after heavy commands (downloads, AI)

// Heavy commands that trigger a cooldown
const HEAVY_COMMANDS = new Set([
  "play", "play2", "video", "ytmp3", "ytmp4", "ytvideo", "youtube", "ytaudio",
  "tiktok", "tt", "instagram", "ig", "facebook", "fb", "spotify",
  "gpt", "gpt4", "gemini", "deepseek", "ds", "imagine", "dalle", "aiimage",
  "generate", "gptimage", "deep", "smooth", "fat", "blown", "robot",
  "chipmunk", "nightcore", "reverse", "slow", "fast", "baby", "demon",
  "bass", "earrape", "tupai", "tomp3", "toptt", "tovideo", "removebg",
]);

// Last heavy command time per user
const heavyCooldowns = new Map();

// Temporarily blocked users (spammers)
const blockedUsers = new Set();
const blockExpiry = new Map();

/**
 * Returns true if the user is allowed to send a command, false if rate-limited.
 * Also handles temporary blocks for extreme spam.
 */
function checkRateLimit(userJid, cmd) {
  // Unblock expired bans
  if (blockedUsers.has(userJid)) {
    const expiry = blockExpiry.get(userJid) || 0;
    if (Date.now() > expiry) {
      blockedUsers.delete(userJid);
      blockExpiry.delete(userJid);
    } else {
      return { allowed: false, reason: "blocked", remainingMs: expiry - Date.now() };
    }
  }

  // Check heavy command cooldown
  if (HEAVY_COMMANDS.has(cmd)) {
    const lastHeavy = heavyCooldowns.get(userJid) || 0;
    const elapsed = Date.now() - lastHeavy;
    if (elapsed < COOLDOWN_HEAVY) {
      return { allowed: false, reason: "cooldown", remainingMs: COOLDOWN_HEAVY - elapsed };
    }
    heavyCooldowns.set(userJid, Date.now());
  }

  // Sliding window counter
  const now = Date.now();
  const bucket = userBuckets.get(userJid) || { count: 0, windowStart: now, warned: false };

  if (now - bucket.windowStart > WINDOW_MS) {
    // Reset window
    bucket.count = 1;
    bucket.windowStart = now;
    bucket.warned = false;
    userBuckets.set(userJid, bucket);
    return { allowed: true };
  }

  bucket.count++;

  if (bucket.count > MAX_COMMANDS_PER_USER + 5) {
    // Extreme spam — block for 5 minutes
    blockedUsers.add(userJid);
    blockExpiry.set(userJid, Date.now() + 5 * 60_000);
    userBuckets.delete(userJid);
    return { allowed: false, reason: "blocked", remainingMs: 5 * 60_000 };
  }

  if (bucket.count > MAX_COMMANDS_PER_USER) {
    userBuckets.set(userJid, bucket);
    return { allowed: false, reason: "ratelimit", remainingMs: WINDOW_MS - (now - bucket.windowStart) };
  }

  userBuckets.set(userJid, bucket);
  return { allowed: true };
}

/**
 * Check if the bot's outgoing message rate is within safe limits.
 * Returns false if the bot is sending too fast (anti-ban).
 */
function checkOutgoingRate() {
  const now = Date.now();
  const bucket = outgoingBuckets.get("bot") || { count: 0, windowStart: now };

  if (now - bucket.windowStart > WINDOW_MS) {
    outgoingBuckets.set("bot", { count: 1, windowStart: now });
    return true;
  }

  bucket.count++;
  outgoingBuckets.set("bot", bucket);
  return bucket.count <= MAX_OUTGOING_PER_MIN;
}

/**
 * Manually block a user for a given duration (ms).
 */
function blockUser(userJid, durationMs = 5 * 60_000) {
  blockedUsers.add(userJid);
  blockExpiry.set(userJid, Date.now() + durationMs);
}

/**
 * Unblock a user.
 */
function unblockUser(userJid) {
  blockedUsers.delete(userJid);
  blockExpiry.delete(userJid);
  userBuckets.delete(userJid);
  heavyCooldowns.delete(userJid);
}

/**
 * Get stats for a user.
 */
function getUserStats(userJid) {
  const bucket = userBuckets.get(userJid);
  const isBlocked = blockedUsers.has(userJid);
  const lastHeavy = heavyCooldowns.get(userJid);
  return {
    isBlocked,
    blockExpiresIn: isBlocked ? Math.max(0, (blockExpiry.get(userJid) || 0) - Date.now()) : 0,
    commandsThisMinute: bucket?.count || 0,
    lastHeavyCommandAgo: lastHeavy ? Date.now() - lastHeavy : null,
  };
}

module.exports = { checkRateLimit, checkOutgoingRate, blockUser, unblockUser, getUserStats, HEAVY_COMMANDS };

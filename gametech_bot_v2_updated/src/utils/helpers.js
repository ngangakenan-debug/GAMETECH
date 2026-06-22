// ╔══════════════════════════════════════════════╗
// ║     GAMETECH BOT - Utility Functions         ║
// ╚══════════════════════════════════════════════╝

const fs = require("fs-extra");
const path = require("path");
const config = require("../config");

// ── Format phone number to JID ─────────────────
function toJid(number) {
  return number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
}

// ── Get sender name ────────────────────────────
function getSenderName(msg) {
  return msg.pushName || msg.key?.participant?.split("@")[0] || "Unknown";
}

// ── Get sender JID ─────────────────────────────
function getSenderJid(msg) {
  return (
    msg.key?.participant ||
    msg.key?.remoteJid ||
    ""
  );
}

// ── Is group message ───────────────────────────
function isGroup(msg) {
  return msg.key?.remoteJid?.endsWith("@g.us") || false;
}

// ── Format time ────────────────────────────────
function formatTime(timestamp) {
  const d = new Date(timestamp * 1000);
  return d.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ── Format uptime ──────────────────────────────
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
}

// ── Download file from URL ─────────────────────
async function downloadFromUrl(url, dest) {
  const fetch = require("node-fetch");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.buffer();
  await fs.outputFile(dest, buf);
  return dest;
}

// ── Clean temp folder ──────────────────────────
async function clearTemp() {
  const dir = config.tempDir;
  const files = await fs.readdir(dir).catch(() => []);
  let count = 0;
  for (const f of files) {
    await fs.remove(path.join(dir, f)).catch(() => {});
    count++;
  }
  return count;
}

// ── Random element from array ─────────────────
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Sleep helper ───────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Generate random string ─────────────────────
function randStr(len = 8) {
  return Math.random().toString(36).substring(2, 2 + len);
}

// ── Pretty bytes ───────────────────────────────
function prettyBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// ── Extract URL from text ─────────────────────
function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

// ── Check if URL is YouTube ───────────────────
function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/.test(url);
}

// ── Check if URL is Instagram ─────────────────
function isInstagramUrl(url) {
  return /instagram\.com/.test(url);
}

// ── Check if URL is Facebook ──────────────────
function isFacebookUrl(url) {
  return /facebook\.com|fb\.watch/.test(url);
}

// ── Check if URL is TikTok ────────────────────
function isTikTokUrl(url) {
  return /tiktok\.com/.test(url);
}

// ── Check if URL is Spotify ───────────────────
function isSpotifyUrl(url) {
  return /spotify\.com/.test(url);
}

module.exports = {
  toJid,
  getSenderName,
  getSenderJid,
  isGroup,
  formatTime,
  formatUptime,
  downloadFromUrl,
  clearTemp,
  randomFrom,
  sleep,
  randStr,
  prettyBytes,
  extractUrl,
  isYouTubeUrl,
  isInstagramUrl,
  isFacebookUrl,
  isTikTokUrl,
  isSpotifyUrl,
};

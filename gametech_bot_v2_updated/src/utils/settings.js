// ╔══════════════════════════════════════════════╗
// ║     GAMETECH BOT - Settings Manager          ║
// ╚══════════════════════════════════════════════╝

const fs = require("fs-extra");
const path = require("path");
const config = require("../config");

const SETTINGS_FILE = path.join(__dirname, "../../sessions/settings.json");

let settings = { ...config.features };

async function load() {
  try {
    if (await fs.pathExists(SETTINGS_FILE)) {
      const saved = await fs.readJson(SETTINGS_FILE);
      settings = { ...settings, ...saved };
    }
  } catch {}
}

async function save() {
  await fs.outputJson(SETTINGS_FILE, settings, { spaces: 2 });
}

function get(key) {
  return settings[key] ?? false;
}

async function set(key, value) {
  settings[key] = value;
  await save();
}

async function toggle(key) {
  settings[key] = !settings[key];
  await save();
  return settings[key];
}

function getAll() {
  return { ...settings };
}

module.exports = { load, save, get, set, toggle, getAll };

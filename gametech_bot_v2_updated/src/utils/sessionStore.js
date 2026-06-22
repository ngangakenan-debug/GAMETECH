// ╔══════════════════════════════════════════════╗
// ║   GAMETECH BOT - Shared Session Store        ║
// ║   Allows commandRouter to read sessionMap    ║
// ╚══════════════════════════════════════════════╝

const sessionMap = new Map();

function getSessions() {
  return [...sessionMap.values()].map((s) => ({
    id:     s.id,
    status: s.status,
    name:   s.user?.name  || null,
    number: s.user?.id    ? s.user.id.split(":")[0].split("@")[0] : null,
    since:  s.connectedAt || null,
  }));
}

function getSessionCount() {
  return {
    total:     sessionMap.size,
    connected: [...sessionMap.values()].filter((s) => s.status === "open").length,
    pending:   [...sessionMap.values()].filter((s) => s.status !== "open").length,
  };
}

module.exports = { sessionMap, getSessions, getSessionCount };

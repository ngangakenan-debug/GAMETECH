// ╔══════════════════════════════════════════════╗
// ║   GAMETECH BOT - Media Downloader            ║
// ║   YouTube (.play), Facebook (.fb),           ║
// ║   Instagram (.ig), TikTok (.tik),            ║
// ║   Twitter (.twit), Y2Mate (.y2t)             ║
// ╚══════════════════════════════════════════════╝

const fs      = require("fs-extra");
const path    = require("path");
const axios   = require("axios");
const ytdl    = require("ytdl-core");
const yts     = require("yt-search");
const config  = require("../config");

// ── ensure temp dir ───────────────────────────
fs.ensureDirSync(config.tempDir);

// ── helpers ───────────────────────────────────
function tmpFile(ext) {
  return path.join(config.tempDir, `gt_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}

async function cleanUp(filepath) {
  try { await fs.remove(filepath); } catch {}
}

function fmtSize(bytes) {
  if (!bytes) return "?";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function fmtDur(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ══════════════════════════════════════════════
// 1. YOUTUBE — .play (mp3) and .yt (mp3/mp4)
// ══════════════════════════════════════════════

async function downloadYoutube(sock, msg, jid, query, format = "mp3") {
  await sock.sendMessage(jid, { text: `🔍 Searching YouTube for: *${query}*...` });

  try {
    // Determine URL vs search query
    let videoUrl = query;
    let videoInfo;

    const isUrl = /youtu\.?be/.test(query);

    if (!isUrl) {
      const search = await yts(query);
      const top = search.videos[0];
      if (!top) {
        return sock.sendMessage(jid, { text: `❌ No YouTube results for: *${query}*\n🧩 GAMETECH BOT` });
      }
      videoUrl = top.url;
    }

    videoInfo = await ytdl.getInfo(videoUrl);
    const details = videoInfo.videoDetails;

    // Guard: refuse videos over 15 min to avoid huge files / timeouts
    if (parseInt(details.lengthSeconds) > 900) {
      return sock.sendMessage(jid, {
        text: `⚠️ *Too Long*\nThis video is ${fmtDur(parseInt(details.lengthSeconds))} — limit is 15:00.\nTry a shorter track.\n🧩 GAMETECH BOT`,
      });
    }

    const infoText =
      `🎵 *${details.title}*\n` +
      `👤 ${details.author?.name || "Unknown"}\n` +
      `⏱️ ${fmtDur(parseInt(details.lengthSeconds))}\n` +
      `👁️ ${Number(details.viewCount).toLocaleString()} views\n\n` +
      `⬇️ Downloading ${format.toUpperCase()}...`;

    await sock.sendMessage(jid, { text: infoText });

    if (format === "mp3") {
      const outPath = tmpFile("mp3");
      await new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, {
          quality: "highestaudio",
          filter: "audioonly",
        });
        const out = fs.createWriteStream(outPath);
        stream.pipe(out);
        stream.on("error", reject);
        out.on("finish", resolve);
        out.on("error", reject);
      });

      const stat = await fs.stat(outPath);
      await sock.sendMessage(jid, {
        audio: { url: outPath },
        mimetype: "audio/mp4",
        ptt: false,
        fileName: `${details.title}.mp3`,
      });
      await sock.sendMessage(jid, {
        text: `✅ *Downloaded!*\n🎵 ${details.title}\n📦 Size: ${fmtSize(stat.size)}\n🧩 GAMETECH BOT`,
      });
      await cleanUp(outPath);

    } else {
      // mp4 — pick lowest resolution that still has video to stay under WA 64MB limit
      const formats = ytdl.filterFormats(videoInfo.formats, "videoandaudio");
      const chosen  = formats.sort((a, b) => (a.contentLength || 0) - (b.contentLength || 0))[0];

      if (!chosen) {
        return sock.sendMessage(jid, {
          text: `❌ No downloadable video format found.\nTry *${config.prefix}play ${query}* for audio only.\n🧩 GAMETECH BOT`,
        });
      }

      const outPath = tmpFile("mp4");
      await new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { format: chosen });
        const out = fs.createWriteStream(outPath);
        stream.pipe(out);
        stream.on("error", reject);
        out.on("finish", resolve);
        out.on("error", reject);
      });

      const stat = await fs.stat(outPath);
      if (stat.size > 60 * 1024 * 1024) {
        await cleanUp(outPath);
        return sock.sendMessage(jid, {
          text: `⚠️ Video too large for WhatsApp (${fmtSize(stat.size)}).\nTry *${config.prefix}play ${query}* for audio only.\n🧩 GAMETECH BOT`,
        });
      }

      await sock.sendMessage(jid, {
        video: { url: outPath },
        caption: `🎬 ${details.title}\n📦 ${fmtSize(stat.size)}\n🧩 GAMETECH BOT`,
        mimetype: "video/mp4",
      });
      await cleanUp(outPath);
    }

  } catch (e) {
    console.error("[Downloader] YouTube error:", e.message);
    await sock.sendMessage(jid, {
      text: `❌ YouTube download failed: ${e.message}\n\nTips:\n• Check the URL is correct\n• Try a shorter video\n• Use a search term instead of URL\n🧩 GAMETECH BOT`,
    });
  }
}

// ══════════════════════════════════════════════
// 2. TWITTER / X — .twit <url>
//    Uses the free LofiAPI (no key needed)
// ══════════════════════════════════════════════

async function downloadTwitter(sock, msg, jid, url) {
  await sock.sendMessage(jid, { text: "🐦 Fetching Twitter/X media..." });
  try {
    const apiUrl = `https://api.lofiapi.com/api/twitter?url=${encodeURIComponent(url)}`;
    const res    = await axios.get(apiUrl, { timeout: 20000 });
    const data   = res.data;

    if (!data || data.error) {
      throw new Error(data?.error || "No media found in that tweet");
    }

    const medias = data.medias || data.media || [];
    if (!medias.length) throw new Error("No downloadable media in that tweet");

    const item    = medias[0];
    const mediaUrl = item.url || item.src;
    const isVideo  = item.type === "video" || /\.mp4/.test(mediaUrl);

    const caption = `🐦 *Twitter/X Media*\n🔗 ${url}\n🧩 GAMETECH BOT`;

    if (isVideo) {
      await sock.sendMessage(jid, { video: { url: mediaUrl }, caption, mimetype: "video/mp4" });
    } else {
      await sock.sendMessage(jid, { image: { url: mediaUrl }, caption });
    }

  } catch (e) {
    console.error("[Downloader] Twitter error:", e.message);

    // Fallback: try fxtwitter oembed for images
    try {
      const fallback = await axios.get(`https://fxtwitter.com/tweet?url=${encodeURIComponent(url)}`, { timeout: 15000 });
      const imgUrl   = fallback.data?.photo?.url;
      if (imgUrl) {
        await sock.sendMessage(jid, {
          image: { url: imgUrl },
          caption: `🐦 *Twitter Media*\n🧩 GAMETECH BOT`,
        });
        return;
      }
    } catch {}

    await sock.sendMessage(jid, {
      text: `❌ Twitter download failed: ${e.message}\n\nMake sure the tweet is public and contains media.\n🧩 GAMETECH BOT`,
    });
  }
}

// ══════════════════════════════════════════════
// 3. TIKTOK — .tik <url>
//    Uses free tikwm.com API
// ══════════════════════════════════════════════

async function downloadTikTok(sock, msg, jid, url) {
  await sock.sendMessage(jid, { text: "🎵 Fetching TikTok video (no watermark)..." });
  try {
    const res  = await axios.post(
      "https://www.tikwm.com/api/",
      new URLSearchParams({ url, hd: "1" }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 25000 }
    );
    const data = res.data?.data;
    if (!data) throw new Error("Could not parse TikTok API response");

    const videoUrl = data.hdplay || data.play;
    const caption  =
      `🎵 *${data.title || "TikTok Video"}*\n` +
      `👤 @${data.author?.unique_id || "unknown"}\n` +
      `❤️ ${Number(data.digg_count || 0).toLocaleString()} likes\n` +
      `🧩 GAMETECH BOT`;

    await sock.sendMessage(jid, { video: { url: videoUrl }, caption, mimetype: "video/mp4" });

  } catch (e) {
    console.error("[Downloader] TikTok error:", e.message);
    await sock.sendMessage(jid, {
      text: `❌ TikTok download failed: ${e.message}\n\nMake sure the video is public.\n🧩 GAMETECH BOT`,
    });
  }
}

// ══════════════════════════════════════════════
// 4. INSTAGRAM — .ig <url>
//    Uses free instaloader-compatible API
// ══════════════════════════════════════════════

async function downloadInstagram(sock, msg, jid, url) {
  await sock.sendMessage(jid, { text: "📸 Fetching Instagram media..." });
  try {
    // Primary: SnapSave API (no key)
    const res  = await axios.get(
      `https://snapsave.app/action.php?lang=en&url=${encodeURIComponent(url)}`,
      { timeout: 20000 }
    );

    // Parse HTML response for download links
    const html  = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    const urls  = [...html.matchAll(/href="(https?:\/\/[^"]+\.(mp4|jpg|jpeg|png)[^"]*)"/gi)]
                    .map(m => m[1]);

    if (!urls.length) throw new Error("No media links found");

    const mediaUrl = urls[0];
    const isVideo  = /\.mp4/.test(mediaUrl);
    const caption  = `📸 *Instagram Media*\n🔗 ${url}\n🧩 GAMETECH BOT`;

    if (isVideo) {
      await sock.sendMessage(jid, { video: { url: mediaUrl }, caption, mimetype: "video/mp4" });
    } else {
      await sock.sendMessage(jid, { image: { url: mediaUrl }, caption });
    }

  } catch (e) {
    console.error("[Downloader] Instagram primary failed:", e.message);

    // Fallback: lofiapi
    try {
      const fb2 = await axios.get(
        `https://api.lofiapi.com/api/instagram?url=${encodeURIComponent(url)}`,
        { timeout: 20000 }
      );
      const items = fb2.data?.medias || fb2.data?.items || [];
      if (items.length) {
        const first  = items[0];
        const mUrl   = first.url || first.src;
        const isVid  = first.type === "video" || /\.mp4/.test(mUrl);
        const cap    = `📸 *Instagram Media*\n🧩 GAMETECH BOT`;
        if (isVid) await sock.sendMessage(jid, { video: { url: mUrl }, caption: cap, mimetype: "video/mp4" });
        else        await sock.sendMessage(jid, { image: { url: mUrl }, caption: cap });
        return;
      }
    } catch {}

    await sock.sendMessage(jid, {
      text: `❌ Instagram download failed.\n\nMake sure the post is *public*.\n🧩 GAMETECH BOT`,
    });
  }
}

// ══════════════════════════════════════════════
// 5. FACEBOOK — .fb <url>
//    Uses free getfvid.com scrape approach
// ══════════════════════════════════════════════

async function downloadFacebook(sock, msg, jid, url) {
  await sock.sendMessage(jid, { text: "📘 Fetching Facebook video..." });
  try {
    // Primary: lofiapi
    const res  = await axios.get(
      `https://api.lofiapi.com/api/facebook?url=${encodeURIComponent(url)}`,
      { timeout: 25000 }
    );
    const data = res.data;

    const hdUrl = data?.hd || data?.sd || data?.url;
    if (!hdUrl) throw new Error("No video URL in API response");

    const quality = data?.hd ? "HD" : "SD";
    await sock.sendMessage(jid, {
      video: { url: hdUrl },
      caption: `📘 *Facebook Video* (${quality})\n🧩 GAMETECH BOT`,
      mimetype: "video/mp4",
    });

  } catch (e) {
    console.error("[Downloader] Facebook primary failed:", e.message);

    // Fallback: fdown.net form submit approach
    try {
      const step1 = await axios.post(
        "https://fdown.net/download.php",
        new URLSearchParams({ URLz: url }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://fdown.net/" }, timeout: 20000 }
      );
      const html   = typeof step1.data === "string" ? step1.data : "";
      const match  = html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
      if (match) {
        await sock.sendMessage(jid, {
          video: { url: match[1] },
          caption: `📘 *Facebook Video*\n🧩 GAMETECH BOT`,
          mimetype: "video/mp4",
        });
        return;
      }
    } catch {}

    await sock.sendMessage(jid, {
      text: `❌ Facebook download failed: ${e.message}\n\nMake sure the video is *public*.\n🧩 GAMETECH BOT`,
    });
  }
}

// ══════════════════════════════════════════════
// 6. Y2MATE — .y2t <url>
//    Resolves via y2mate.com's API to get
//    direct audio/video download links
// ══════════════════════════════════════════════

async function downloadY2mate(sock, msg, jid, url) {
  await sock.sendMessage(jid, { text: "⚡ Processing via Y2Mate..." });
  try {
    // Step 1: Analyse
    const step1 = await axios.post(
      "https://www.y2mate.com/mates/analyzeV2/ajax",
      new URLSearchParams({ k_query: url, k_page: "home", hl: "en", q_auto: "0" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 20000,
      }
    );

    const links = step1.data?.links;
    const title  = step1.data?.title || "Media";

    // Prefer mp3 audio, fall back to best video
    const audioLinks = links?.mp3?.mp3 || {};
    const videoLinks = links?.mp4  || {};

    // Pick highest quality audio key
    const audioKey = Object.keys(audioLinks).find(k => audioLinks[k]?.f === "mp3") ||
                     Object.keys(audioLinks)[0];
    const videoKey = Object.keys(videoLinks).find(k => videoLinks[k]?.q?.includes("720")) ||
                     Object.keys(videoLinks)[0];

    const chosenKey  = audioKey || videoKey;
    const chosenType = audioKey ? "mp3" : "mp4";
    const formatData = audioLinks[chosenKey] || videoLinks[chosenKey];

    if (!chosenKey || !formatData?.k) throw new Error("No downloadable format found");

    // Step 2: Convert / get direct URL
    const step2 = await axios.post(
      "https://www.y2mate.com/mates/convertV2/index",
      new URLSearchParams({ vid: step1.data.vid, k: formatData.k }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0",
        },
        timeout: 30000,
      }
    );

    const dlUrl = step2.data?.dlink;
    if (!dlUrl) throw new Error("Y2Mate did not return a download link");

    const caption = `⚡ *Y2Mate Download*\n🎵 ${title}\n🧩 GAMETECH BOT`;

    if (chosenType === "mp3") {
      await sock.sendMessage(jid, { audio: { url: dlUrl }, mimetype: "audio/mp4", ptt: false });
      await sock.sendMessage(jid, { text: caption });
    } else {
      await sock.sendMessage(jid, { video: { url: dlUrl }, caption, mimetype: "video/mp4" });
    }

  } catch (e) {
    console.error("[Downloader] Y2Mate error:", e.message);
    await sock.sendMessage(jid, {
      text: `❌ Y2Mate failed: ${e.message}\n\nTip: Y2Mate works best with YouTube URLs.\nTry: ${config.prefix}yt <youtube-url>\n🧩 GAMETECH BOT`,
    });
  }
}

// ── Spotify stub ──────────────────────────────
async function downloadSpotify(sock, msg, jid, query) {
  await sock.sendMessage(jid, { text: `🎧 Searching for: *${query}*\n\n_(Spotify audio is converted via YouTube)_` });
  // Strip track name from Spotify URL if given, then delegate to YT mp3
  const cleanQuery = query.replace(/https?:\/\/open\.spotify\.com\/[a-z]+\/[a-zA-Z0-9]+\??.*/, query);
  await downloadYoutube(sock, msg, jid, cleanQuery, "mp3");
}

module.exports = {
  downloadYoutube,
  downloadTwitter,
  downloadTikTok,
  downloadInstagram,
  downloadFacebook,
  downloadY2mate,
  downloadSpotify,
};

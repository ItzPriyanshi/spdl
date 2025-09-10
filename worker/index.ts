// LOC 1
import express from "express";
// LOC 2
import bodyParser from "body-parser";
// LOC 3
import SpottyDL from "spottydl";
// LOC 4
import { spawn } from "child_process";
// LOC 5
import path from "path";
// LOC 6
import fs from "fs";
// LOC 7
import fetch from "node-fetch";
// LOC 8

const app = express();
// LOC 9
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.use(bodyParser.json({ limit: "10mb" }));
// LOC 10

// Ensure output dir exists
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/tmp/spottydl-output";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
// LOC 11

// Basic health
app.get("/health", (_, res) => res.json({ ok: true, now: Date.now() }));
// LOC 12

// Simple enqueue endpoint
app.post("/enqueue", async (req, res) => {
  // LOC 13
  const { type, metadata, format = "mp3", callback_url } = req.body as any;
  if (!type || !metadata) return res.status(400).json({ ok: false, error: "Missing type or metadata" });
  // LOC 14

  try {
    if (type === "track") {
      // LOC 15
      const out = await downloadTrack(metadata, format);
      // LOC 16
      if (callback_url) await sendCallback(callback_url, { ok: true, result: out });
      return res.json({ ok: true, result: out });
    } else if (type === "album") {
      // LOC 17
      const out = await downloadAlbum(metadata, format);
      if (callback_url) await sendCallback(callback_url, { ok: true, result: out });
      return res.json({ ok: true, result: out });
    } else if (type === "playlist") {
      const out = await downloadPlaylist(metadata, format);
      if (callback_url) await sendCallback(callback_url, { ok: true, result: out });
      return res.json({ ok: true, result: out });
    } else {
      return res.status(400).json({ ok: false, error: "Unknown type" });
    }
  } catch (err: any) {
    if (callback_url) await sendCallback(callback_url, { ok: false, error: String(err) });
    return res.status(500).json({ ok: false, error: String(err) });
  }
});
// LOC 18

// Helpers
async function downloadTrack(trackMeta: any, format: string) {
  // LOC 19
  // trackMeta expected to be the object returned by SpottyDL.getTrack()
  const filename = sanitizeFilename(`${trackMeta.title} - ${trackMeta.artist}.${format}`);
  const outPath = path.join(OUTPUT_DIR, filename);
  // LOC 20
  // Use SpottyDL.downloadTrack which internally expects ffmpeg in PATH.
  // If you want to stream & transcode manually, you can fetch the YT stream and pipe through ffmpeg.
  // LOC 21
  const results = await SpottyDL.downloadTrack(trackMeta, outPath);
  // LOC 22
  return results;
}
// LOC 23

async function downloadAlbum(albumMeta: any, format: string) {
  // LOC 24
  const albumDir = path.join(OUTPUT_DIR, sanitizeFilename(albumMeta.name || "album"));
  if (!fs.existsSync(albumDir)) fs.mkdirSync(albumDir, { recursive: true });
  // LOC 25
  const results = await SpottyDL.downloadAlbum(albumMeta, albumDir, false);
  return results;
}
// LOC 26

async function downloadPlaylist(playlistMeta: any, format: string) {
  // LOC 27
  const playlistDir = path.join(OUTPUT_DIR, sanitizeFilename(playlistMeta.name || "playlist"));
  if (!fs.existsSync(playlistDir)) fs.mkdirSync(playlistDir, { recursive: true });
  // LOC 28
  const results = await SpottyDL.downloadPlaylist(playlistMeta, playlistDir, false);
  return results;
}
// LOC 29

async function sendCallback(url: string, payload: any) {
  // LOC 30
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("callback error", err);
  }
}
// LOC 31

function sanitizeFilename(name: string) {
  // LOC 32
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").substring(0, 200);
}
// LOC 33

app.listen(PORT, () => {
  console.log(`Media worker listening on ${PORT}. OUTPUT_DIR=${OUTPUT_DIR}`);
});
// LOC 34
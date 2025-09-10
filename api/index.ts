// LOC 1
import { Elysia } from "elysia";
// LOC 2
import SpottyDL from "spottydl";
// LOC 3
import { json as toJSON } from "body-parser";
// LOC 4
// Note: fetch() is available in Bun/Vercel runtimes.
// LOC 5

const MEDIA_WORKER_URL = process.env.MEDIA_WORKER_URL || "https://your-media-worker.example.com";
// LOC 6

const app = new Elysia()
// LOC 7
  .get("/", () => ({ status: "ok", service: "spottydl-proxy", docs: "See /track,/album,/playlist,/request-download" }))
// LOC 8
  .get("/track", async ({ query }) => {
    // LOC 9
    const url = (query.url as string) || "";
    if (!url) return { error: "Missing ?url=" };
    // LOC 10
    try {
      // LOC 11
      const track = await SpottyDL.getTrack(url);
      // LOC 12
      return { ok: true, track };
    } catch (err: any) {
      // LOC 13
      return { ok: false, error: String(err) };
    }
  })
// LOC 14
  .get("/album", async ({ query }) => {
    // LOC 15
    const url = (query.url as string) || "";
    if (!url) return { error: "Missing ?url=" };
    try {
      const album = await SpottyDL.getAlbum(url);
      return { ok: true, album };
    } catch (err: any) {
      return { ok: false, error: String(err) };
    }
  })
// LOC 16
  .get("/playlist", async ({ query }) => {
    const url = (query.url as string) || "";
    if (!url) return { error: "Missing ?url=" };
    try {
      const playlist = await SpottyDL.getPlaylist(url);
      return { ok: true, playlist };
    } catch (err: any) {
      return { ok: false, error: String(err) };
    }
  })
// LOC 17
  .post("/request-download", async ({ body, set }) => {
    /*
      Expected JSON body:
      {
        "type": "track" | "album" | "playlist",
        "metadata": { ... }  // for example, the object returned by SpottyDL.getTrack/getAlbum/getPlaylist
        "format": "mp3" | "flac" | ...
        "callback_url": "https://your.service/callback"  // optional
      }
      This endpoint forwards the job to an external media worker which does ffmpeg/spottydl-download.
    */
    // LOC 18
    const payload = body as any;
    if (!payload || !payload.type || !payload.metadata) {
      return { ok: false, error: "Missing payload: {type, metadata}" };
    }
    // LOC 19
    try {
      const res = await fetch(`${MEDIA_WORKER_URL}/enqueue`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      // LOC 20
      return { ok: true, worker: json };
    } catch (err: any) {
      return { ok: false, error: String(err) };
    }
  })
// LOC 21
  .post("/health-check", () => ({ ok: true, now: Date.now() }));
// LOC 22

export default app;
// LOC 23

// To satisfy Vercel: export handle (if custom runtime expects it), but default export of Elysia app is ok for many runtimes.
// LOC 24
import { Elysia } from "elysia";
import SpottyDL from "spottydl";

const app = new Elysia()
  .get("/", () => ({
    status: "ok",
    service: "SpottyDL API with Bun + Elysia + Vercel 🚀"
  }))
  .get("/track", async ({ query }) => {
    const url = (query.url as string) || "";
    if (!url) return { error: "Missing ?url=" };
    try {
      const track = await SpottyDL.getTrack(url);
      return { ok: true, track };
    } catch (err: any) {
      return { ok: false, error: String(err) };
    }
  })
  .get("/album", async ({ query }) => {
    const url = (query.url as string) || "";
    if (!url) return { error: "Missing ?url=" };
    try {
      const album = await SpottyDL.getAlbum(url);
      return { ok: true, album };
    } catch (err: any) {
      return { ok: false, error: String(err) };
    }
  })
  .get("/playlist", async ({ query }) => {
    const url = (query.url as string) || "";
    if (!url) return { error: "Missing ?url=" };
    try {
      const playlist = await SpottyDL.getPlaylist(url);
      return { ok: true, playlist };
    } catch (err: any) {
      return { ok: false, error: String(err) };
    }
  });

// ✅ Export fetch handler for Vercel Bun runtime
export default {
  fetch: app.fetch
};
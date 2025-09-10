# SpottyDL Vercel Proxy + Media Worker

Architecture:
- Vercel function (Bun + Elysia + TypeScript): lightweight proxy that fetches metadata using SpottyDL and enqueues jobs to a media worker.
- Media Worker (Docker): runs SpottyDL downloads + ffmpeg locally, writes files to disk or uploads to S3.

## Why split?
Vercel serverless functions typically have size/time limits. Bundling ffmpeg into a Vercel function often exceeds space limits or times out. See Vercel docs / community notes. 4

## Deploying Vercel function
1. Put `vercel.json`, `package.json`, and `api/index.ts` in your repo.
2. Set environment variable `MEDIA_WORKER_URL` in Vercel Dashboard to your worker URL.
3. Deploy to Vercel (GitHub integration or `vercel` CLI).

## Deploying media worker
1. Build Docker image:
   ```bash
   docker build -t spottydl-worker ./worker
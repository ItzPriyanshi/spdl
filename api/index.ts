import { Elysia } from 'elysia'
import ytdl from 'ytdl-core'
import SpotifyWebApi from 'spotify-web-api-node'
import axios from 'axios'
import urlMetadata from 'url-metadata'

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID ?? ''
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? ''

const spotifyApi = new SpotifyWebApi({
  clientId: spotifyClientId,
  clientSecret: spotifyClientSecret
})

async function spotifyAuth() {
  if (!spotifyClientId || !spotifyClientSecret) return null
  try {
    const data = await spotifyApi.clientCredentialsGrant()
    spotifyApi.setAccessToken(data.body.access_token)
    return data.body.expires_in
  } catch {
    return null
  }
}

function parseProvider(url: string) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
    if (host.includes('spotify.com')) return 'spotify'
    return 'generic'
  } catch {
    return 'invalid'
  }
}

async function youtubeInfo(url: string) {
  if (!ytdl.validateURL(url) && !ytdl.validateID(url)) throw new Error('Invalid YouTube URL/ID')
  const info = await ytdl.getInfo(url)
  const videoDetails = info.videoDetails
  return {
    id: videoDetails.videoId,
    title: videoDetails.title,
    description: videoDetails.shortDescription,
    lengthSeconds: Number(videoDetails.lengthSeconds || 0),
    thumbnails: videoDetails.thumbnails,
    author: {
      name: videoDetails.author?.name,
      channelId: videoDetails.author?.channelId,
      url: videoDetails.author?.user_url || `https://www.youtube.com/channel/${videoDetails.author?.channelId}`
    },
    formats: info.formats.map(f => ({
      itag: f.itag,
      mimeType: f.mimeType,
      audioBitrate: f.audioBitrate,
      container: f.container,
      hasVideo: !!f.qualityLabel,
      bitrate: f.bitrate,
      approxDurationMs: f.approxDurationMs
    }))
  }
}

async function spotifyResolve(url: string) {
  if (!spotifyClientId || !spotifyClientSecret) {
    throw new Error('Spotify client id/secret not provided')
  }
  await spotifyAuth()
  const u = new URL(url)
  const parts = u.pathname.split('/').filter(Boolean)
  const type = parts[0]
  const id = parts[1]
  if (!type || !id) throw new Error('Invalid Spotify URL')
  if (type === 'track') {
    const data = await spotifyApi.getTrack(id)
    const t = data.body
    return {
      type: 'track',
      id: t.id,
      title: t.name,
      artists: t.artists.map(a => ({ id: a.id, name: a.name, external_urls: a.external_urls })),
      album: {
        id: t.album.id,
        name: t.album.name,
        images: t.album.images
      },
      duration_ms: t.duration_ms,
      explicit: t.explicit,
      external_urls: t.external_urls,
      preview_url: t.preview_url
    }
  } else if (type === 'album') {
    const data = await spotifyApi.getAlbum(id)
    const a = data.body
    const tracks = await spotifyApi.getAlbumTracks(id, { limit: 50 })
    return {
      type: 'album',
      id: a.id,
      name: a.name,
      artists: a.artists.map(x => ({ id: x.id, name: x.name })),
      images: a.images,
      tracks: tracks.body.items.map(t => ({
        id: t.id,
        name: t.name,
        duration_ms: t.duration_ms,
        preview_url: t.preview_url,
        track_number: t.track_number
      }))
    }
  } else if (type === 'playlist') {
    const data = await spotifyApi.getPlaylist(id, { limit: 100 })
    const p = data.body
    return {
      type: 'playlist',
      id: p.id,
      name: p.name,
      owner: p.owner && { id: p.owner.id, display_name: p.owner.display_name },
      images: p.images,
      tracks: p.tracks.items.map(it => {
        const t = it.track
        return {
          id: t?.id,
          name: t?.name,
          artists: t?.artists?.map(a => ({ id: a.id, name: a.name })),
          duration_ms: t?.duration_ms,
          preview_url: t?.preview_url
        }
      })
    }
  } else {
    throw new Error('Unsupported Spotify type')
  }
}

async function genericInfo(url: string) {
  try {
    const md = await urlMetadata(url)
    return {
      title: md.title,
      description: md.description,
      image: md.image,
      site: md.site
    }
  } catch {
    return { title: null, description: null, image: null, site: null }
  }
}

const app = new Elysia()

app.get('/info', async ({ query }) => {
  const url = (query.url as string) || ''
  if (!url) return { ok: false, error: 'url query param required' }
  const provider = parseProvider(url)
  try {
    if (provider === 'youtube') {
      const info = await youtubeInfo(url)
      return { ok: true, provider: 'youtube', info }
    } else if (provider === 'spotify') {
      const info = await spotifyResolve(url)
      return { ok: true, provider: 'spotify', info }
    } else if (provider === 'generic') {
      const info = await genericInfo(url)
      return { ok: true, provider: 'generic', info }
    } else {
      return { ok: false, error: 'invalid url' }
    }
  } catch (e: any) {
    return { ok: false, error: String(e.message ?? e) }
  }
})

app.get('/track', async ({ query, set }) => {
  const url = (query.url as string) || ''
  if (!url) return { ok: false, error: 'url query param required' }
  const provider = parseProvider(url)
  try {
    if (provider === 'youtube') {
      const info = await youtubeInfo(url)
      return { ok: true, provider: 'youtube', track: {
        id: info.id,
        title: info.title,
        author: info.author,
        lengthSeconds: info.lengthSeconds,
        thumbnails: info.thumbnails
      } }
    } else if (provider === 'spotify') {
      const info = await spotifyResolve(url)
      return { ok: true, provider: 'spotify', track: info }
    } else {
      const md = await genericInfo(url)
      return { ok: true, provider: 'generic', track: md }
    }
  } catch (e: any) {
    return { ok: false, error: String(e.message ?? e) }
  }
})

app.get('/down', async (ctx) => {
  const url = (ctx.query.url as string) || ''
  if (!url) return { status: 400, body: { ok: false, error: 'url query param required' } }
  const provider = parseProvider(url)
  if (provider === 'youtube') {
    try {
      if (!ytdl.validateURL(url) && !ytdl.validateID(url)) {
        return { status: 400, body: { ok: false, error: 'invalid youtube url' } }
      }
      const info = await ytdl.getInfo(url)
      const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' })
      const headers = new Headers()
      headers.set('Content-Type', audioFormat.mimeType?.split(';')[0] ?? 'audio/mpeg')
      headers.set('Content-Disposition', `attachment; filename="${info.videoDetails.title.replace(/[^a-z0-9.\-_]/gi, '_')}.mp3"`)
      ctx.set('Cache-Control', 'public, max-age=3600')
      const stream = ytdl.stream(url, { quality: 'highestaudio' })
      return new Response(stream as any, { headers })
    } catch (e: any) {
      return { status: 500, body: { ok: false, error: String(e.message ?? e) } }
    }
  } else if (provider === 'spotify') {
    try {
      const info = await spotifyResolve(url)
      if (info.preview_url) {
        const r = await axios.get(info.preview_url, { responseType: 'arraybuffer' })
        const headers = new Headers()
        headers.set('Content-Type', 'audio/mpeg')
        headers.set('Content-Disposition', `attachment; filename="${(info.title ?? 'preview').replace(/[^a-z0-9.\-_]/gi, '_')}.mp3"`)
        return new Response(r.data, { headers })
      } else {
        return { status: 402, body: { ok: false, error: 'No preview available for Spotify item. Spotify API does not provide full audio download.' } }
      }
    } catch (e: any) {
      return { status: 500, body: { ok: false, error: String(e.message ?? e) } }
    }
  } else {
    try {
      const md = await urlMetadata(url)
      if (md.image) {
        return { ok: true, redirect: md.image }
      } else {
        return { ok: false, error: 'No downloadable resource found for generic URL' }
      }
    } catch (e: any) {
      return { status: 500, body: { ok: false, error: String(e.message ?? e) } }
    }
  }
})

app.get('/', () => ({ ok: true, message: 'Elysia media API running', endpoints: ['/info?url=', '/track?url=', '/down?url='] }))

export default app.handle
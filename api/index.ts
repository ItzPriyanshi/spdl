import { Elysia } from 'elysia'
import SpotifyDL from 'spotify-dl'
import axios from 'axios'
import urlMetadata from 'url-metadata'

const spotify = new SpotifyDL()

function parseProvider(url: string): 'spotify' | 'generic' | 'invalid' {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')
    if (host.includes('spotify.com')) return 'spotify'
    return 'generic'
  } catch {
    return 'invalid'
  }
}

async function spotifyInfo(url: string) {
  // getTrack, getAlbum, getPlaylist
  if (url.includes('/track/')) return { type: 'track', data: await spotify.getTrack(url) }
  if (url.includes('/album/')) return { type: 'album', data: await spotify.getAlbum(url) }
  if (url.includes('/playlist/')) return { type: 'playlist', data: await spotify.getPlaylist(url) }
  throw new Error('Unsupported Spotify type')
}

async function genericInfo(url: string) {
  try {
    const md = await urlMetadata(url)
    return { title: md.title, description: md.description, image: md.image, site: md.site }
  } catch {
    return { title: null, description: null, image: null, site: null }
  }
}

const app = new Elysia()

app.get('/info', async ({ query }) => {
  const url = (query.url as string) || ''
  if (!url) return { ok: false, error: 'url param required' }

  const provider = parseProvider(url)
  try {
    if (provider === 'spotify') {
      const info = await spotifyInfo(url)
      return { ok: true, provider: 'spotify', info }
    } else if (provider === 'generic') {
      const info = await genericInfo(url)
      return { ok: true, provider: 'generic', info }
    } else {
      return { ok: false, error: 'invalid url' }
    }
  } catch (e: any) {
    return { ok: false, error: String(e.message) }
  }
})

app.get('/track', async ({ query }) => {
  // Similar: for Spotify track return minimal info
  const url = (query.url as string) || ''
  if (!url) return { ok: false, error: 'url param required' }
  try {
    const { type, data } = await spotifyInfo(url)
    if (type === 'track') {
      return { ok: true, provider: 'spotify', track: data }
    }
    return { ok: false, error: 'Not a track URL' }
  } catch (e: any) {
    return { ok: false, error: String(e.message) }
  }
})

app.get('/down', async (ctx) => {
  const url = (ctx.query.url as string) || ''
  if (!url) return { status: 400, body: { ok: false, error: 'url param required' } }

  const provider = parseProvider(url)
  try {
    if (provider === 'spotify') {
      const buffer = await spotify.downloadTrack(url)
      const headers = new Headers()
      headers.set('Content-Type', 'audio/mpeg')
      headers.set('Content-Disposition', `attachment; filename="track.mp3"`)
      return new Response(buffer as any, { headers })
    } else {
      const md = await urlMetadata(url)
      if (md.image) {
        return { ok: true, redirect: md.image }
      }
      return { ok: false, error: 'No asset to download' }
    }
  } catch (e: any) {
    return { status: 500, body: { ok: false, error: String(e.message) } }
  }
})

app.get('/', () => ({ ok: true, endpoints: ['/info?url=', '/track?url=', '/down?url='] }))

export default app.handle
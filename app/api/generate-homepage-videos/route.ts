import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FAL_KEY = process.env.FAL_API_KEY!
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const IMAGES = {
  hero: 'https://v3b.fal.media/files/b/0a9dc82f/qSFW82dOEK5PMHb--MQvl.jpg',
  ai: 'https://v3b.fal.media/files/b/0a9dc82f/88gQU_rbqHUneOexDyfHO.jpg',
  drone: 'https://v3b.fal.media/files/b/0a9dc82f/tjT9L2NkpUNYPNnkQ-8gY.jpg',
}

async function startJob(prompt: string, imageUrl: string): Promise<string> {
  const res = await fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_url: imageUrl, duration: '5', resolution: '720p', motion_intensity: 'low' })
  })
  const data = await res.json()
  return data.request_id || ''
}

async function saveToSupabase(url: string, filename: string): Promise<string> {
  try {
    const res = await fetch(url)
    const buffer = Buffer.from(await res.arrayBuffer())
    await sb.storage.from('client-videos').upload(`homepage/${filename}`, buffer, {
      contentType: 'video/mp4', upsert: true
    })
    const { data } = sb.storage.from('client-videos').getPublicUrl(`homepage/${filename}`)
    return data.publicUrl
  } catch { return url }
}

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get('start')
  const requestId = req.nextUrl.searchParams.get('id')
  const save = req.nextUrl.searchParams.get('save') // ?save=hero|ai|drone&url=...

  // Start all 3 video jobs
  if (start === '1') {
    const [heroId, aiId, droneId] = await Promise.all([
      startJob('Slow cinematic camera drift over dark city at night, teal neon bokeh, ultra smooth slow motion', IMAGES.hero),
      startJob('Floating glowing neural network particles slowly pulsing, ambient teal light movement', IMAGES.ai),
      startJob('Smooth slow aerial drone glide over restaurant golden hour, warm cinematic motion', IMAGES.drone),
    ])
    return NextResponse.json({ heroId, aiId, droneId })
  }

  // Save a completed video to Supabase permanently
  if (save && req.nextUrl.searchParams.get('url')) {
    const videoUrl = req.nextUrl.searchParams.get('url')!
    const permanent = await saveToSupabase(videoUrl, `${save}.mp4`)
    return NextResponse.json({ permanent })
  }

  // Poll job status
  if (requestId) {
    try {
      const res = await fetch(
        `https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      )
      const text = await res.text()
      if (!text || text.trim() === '') {
        return NextResponse.json({ status: 'processing', videoUrl: null })
      }
      const data = JSON.parse(text)
      const status = data.status === 'COMPLETED' ? 'completed' : data.status === 'FAILED' ? 'failed' : 'processing'
      const videoUrl = data.video?.url || data.output?.video?.url || null
      return NextResponse.json({ status, videoUrl })
    } catch {
      return NextResponse.json({ status: 'processing', videoUrl: null })
    }
  }

  return NextResponse.json({ error: 'Missing params' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { type } = await req.json()
  const configs: Record<string, { prompt: string; image: string }> = {
    hero: { prompt: 'Slow cinematic camera drift over dark city at night, teal neon bokeh, ultra smooth', image: IMAGES.hero },
    ai: { prompt: 'Floating neural network particles pulsing, teal light, cinematic', image: IMAGES.ai },
    drone: { prompt: 'Smooth aerial drone over restaurant golden hour, cinematic motion', image: IMAGES.drone },
  }
  const config = configs[type]
  if (!config) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  const id = await startJob(config.prompt, config.image)
  return NextResponse.json({ requestId: id })
}

import { NextRequest, NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_API_KEY!

const IMAGES = {
  hero: 'https://v3b.fal.media/files/b/0a9db43e/-uLoWg3o-1RSESNxB1W5r.jpg',
  ai: 'https://v3b.fal.media/files/b/0a9db43e/1ur9TGpHGvlMFZDARj0Ky.jpg',
  drone: 'https://v3b.fal.media/files/b/0a9db43d/H_XDi7HNUnec0eLey58zO.jpg',
}

// POST - start video generation jobs
export async function POST(req: NextRequest) {
  const { type } = await req.json()

  const configs: Record<string, { prompt: string; image: string }> = {
    hero: {
      prompt: 'Slow cinematic camera drift over dark city at night, teal neon bokeh lights, ultra smooth slow motion',
      image: IMAGES.hero
    },
    ai: {
      prompt: 'Floating glowing neural network particles slowly pulsing, ambient teal light movement, cinematic',
      image: IMAGES.ai
    },
    drone: {
      prompt: 'Smooth slow aerial drone glide over restaurant golden hour, warm cinematic motion, professional',
      image: IMAGES.drone
    }
  }

  const config = configs[type]
  if (!config) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const res = await fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: config.prompt,
      image_url: config.image,
      duration: '5',
      resolution: '720p',
      motion_intensity: 'low'
    })
  })
  const data = await res.json()
  return NextResponse.json({ requestId: data.request_id })
}

// GET with ?start=1 - kick off all 3 video jobs
// GET with ?id=X - check specific job status
export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get('start')

  if (start === '1') {
    const jobs = await Promise.all([
      fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
        method: 'POST',
        headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Slow cinematic camera drift over dark city at night, teal neon bokeh, ultra smooth slow motion', image_url: IMAGES.hero, duration: '5', resolution: '720p', motion_intensity: 'low' })
      }).then(r => r.json()),
      fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
        method: 'POST',
        headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Floating glowing neural network particles slowly pulsing, ambient teal light movement', image_url: IMAGES.ai, duration: '5', resolution: '720p', motion_intensity: 'low' })
      }).then(r => r.json()),
      fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
        method: 'POST',
        headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Smooth slow aerial drone glide over restaurant golden hour, warm cinematic motion', image_url: IMAGES.drone, duration: '5', resolution: '720p', motion_intensity: 'low' })
      }).then(r => r.json()),
    ])
    return NextResponse.json({
      heroId: jobs[0].request_id,
      aiId: jobs[1].request_id,
      droneId: jobs[2].request_id,
    })
  }

  const requestId = req.nextUrl.searchParams.get('id')
  if (!requestId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const res = await fetch(
    `https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video/requests/${requestId}`,
    { headers: { 'Authorization': `Key ${FAL_KEY}` } }
  )
  const data = await res.json()
  return NextResponse.json({
    status: data.status === 'COMPLETED' ? 'completed' : data.status === 'FAILED' ? 'failed' : 'processing',
    videoUrl: data.video?.url || null
  })
}

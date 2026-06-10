import { NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_API_KEY!

async function startVideo(prompt: string, imageUrl: string): Promise<string> {
  const res = await fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      duration: '5',
      resolution: '720p',
      motion_intensity: 'low'
    })
  })
  const data = await res.json()
  return data.request_id || ''
}

async function pollVideo(requestId: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video/requests/${requestId}`, {
      headers: { 'Authorization': `Key ${FAL_KEY}` }
    })
    const data = await res.json()
    if (data.status === 'COMPLETED' && data.video?.url) return data.video.url
    if (data.status === 'FAILED') return ''
  }
  return ''
}

export async function GET() {
  // Use the fal.ai generated images as source frames
  const images = {
    hero: 'https://v3b.fal.media/files/b/0a9db43e/-uLoWg3o-1RSESNxB1W5r.jpg',
    ai: 'https://v3b.fal.media/files/b/0a9db43e/1ur9TGpHGvlMFZDARj0Ky.jpg',
    drone: 'https://v3b.fal.media/files/b/0a9db43d/H_XDi7HNUnec0eLey58zO.jpg',
  }

  // Start all 3 videos in parallel
  const [heroId, aiId, droneId] = await Promise.all([
    startVideo('Slow cinematic camera drift over dark city at night, teal neon bokeh lights, ultra smooth motion', images.hero),
    startVideo('Floating glowing neural network particles slowly pulsing in deep space, ambient teal light movement', images.ai),
    startVideo('Smooth slow aerial drone glide over restaurant golden hour, warm cinematic motion blur', images.drone),
  ])

  // Poll all in parallel
  const [heroUrl, aiUrl, droneUrl] = await Promise.all([
    heroId ? pollVideo(heroId) : Promise.resolve(''),
    aiId ? pollVideo(aiId) : Promise.resolve(''),
    droneId ? pollVideo(droneId) : Promise.resolve(''),
  ])

  return NextResponse.json({ heroUrl, aiUrl, droneUrl, heroId, aiId, droneId })
}

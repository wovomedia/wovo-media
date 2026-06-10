import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { prompt, clientId, count = 2 } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 })

  const FAL_KEY = process.env.FAL_API_KEY
  if (!FAL_KEY) return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })

  const images: string[] = []

  for (let i = 0; i < Math.min(count, 4); i++) {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true
      })
    })

    const data = await res.json()
    if (data.images?.[0]?.url) {
      images.push(data.images[0].url)
    }
  }

  if (images.length === 0) {
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }

  // Save to DB
  if (clientId) {
    for (const url of images) {
      try {
        await sb.from('client_images').insert({
          client_id: clientId,
          prompt,
          image_url: url,
          model: 'flux-schnell'
        })
      } catch {}
    }
  }

  return NextResponse.json({ images })
}

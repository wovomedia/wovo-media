import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FAL_KEY = process.env.FAL_API_KEY!
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  // Generate AI avatar based on Payton's description - curly dark brown hair, 20yo, round face
  const prompts = [
    'Professional headshot of a young 20-year-old male entrepreneur, curly dark brown hair, friendly approachable expression, slight smile, clean white background, teal accent lighting, wearing a dark business casual shirt, sharp eyes, photorealistic portrait, 4K quality',
    'Young male tech founder, 20 years old, dark curly/wavy brown hair, confident expression looking at camera, professional studio lighting, dark background with teal glow, sharp professional photo, business casual, photorealistic',
    'Professional portrait young male entrepreneur 20s, brown curly hair, genuine friendly smile, modern tech company style, dark moody background, teal rim lighting, photorealistic headshot quality',
    'Young charismatic male founder, curly dark hair, direct eye contact, confident smirk, professional photo, dark background teal accents, sharp focus, photorealistic portrait, startup CEO vibe'
  ]

  const results = await Promise.all(prompts.map(prompt =>
    fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_size: 'portrait_4_3', num_inference_steps: 28, guidance_scale: 3.5, num_images: 1 })
    }).then(r => r.json()).then(d => d.images?.[0]?.url || null)
  ))

  const images = results.filter(Boolean)

  // Save best one to Supabase storage as nova-avatar
  if (images[0]) {
    try {
      const imgRes = await fetch(images[0])
      const blob = await imgRes.blob()
      const arrayBuffer = await blob.arrayBuffer()
      await sb.storage.from('client-videos').upload('nova-avatar.jpg', Buffer.from(arrayBuffer), {
        contentType: 'image/jpeg', upsert: true
      })
    } catch {}
  }

  return NextResponse.json({ images })
}

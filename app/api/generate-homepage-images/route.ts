import { NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_API_KEY!

async function img(prompt: string): Promise<string> {
  const res = await fetch('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'landscape_16_9', num_inference_steps: 28, num_images: 1, guidance_scale: 3.5 })
  })
  const data = await res.json()
  return data.images?.[0]?.url || ''
}

export async function GET() {
  const [hero, social, ai, drone, cinAd] = await Promise.all([
    img('Cinematic dark city aerial view at night, teal cyan neon reflections wet streets, bokeh, ultra wide, 8K cinematic, no people, no text, photorealistic'),
    img('Person holding smartphone showing vibrant social media content, dark moody background, teal accent lighting, cinematic, no text, photorealistic'),
    img('Futuristic AI neural network glowing teal cyan particles dark space, abstract tech visualization, soft light trails, cinematic, no text'),
    img('Cinematic drone aerial view upscale restaurant golden hour, warm orange teal color grade, professional cinematography, photorealistic'),
    img('Luxury product dark reflective surface, dramatic studio lighting teal gold accents, cinematic depth of field, commercial photography, no text')
  ])
  return NextResponse.json({ hero, social, ai, drone, cinAd })
}

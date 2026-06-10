import { NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_API_KEY!

export async function GET() {
  // Use fal.ai flux with IP-Adapter to generate professional AI avatar based on Payton's likeness
  // Using the front-facing photo as reference
  const res = await fetch('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Professional portrait photo of a young 20-year-old male entrepreneur, curly dark brown hair, slightly wavy, clean modern professional look, confident friendly smile, dark background with subtle teal lighting, professional headshot quality, sharp focus, photorealistic, wearing a clean shirt, cinematic lighting, suitable for a tech company AI assistant',
      image_size: 'portrait_4_3',
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 4,
    })
  })
  const data = await res.json()
  const images = data.images?.map((i: any) => i.url) || []
  return NextResponse.json({ images })
}

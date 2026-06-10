import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function claudeSearch(prompt: string, maxTokens = 500): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const data = await res.json()
  return data.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim() || ''
}

async function generateImage(prompt: string): Promise<string> {
  const FAL_KEY = process.env.FAL_API_KEY
  if (!FAL_KEY) return 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=1280&q=80'

  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'landscape_16_9', num_inference_steps: 4, num_images: 1 })
  })
  const data = await res.json()
  return data.images?.[0]?.url || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=1280&q=80'
}

async function generateVideo(prompt: string, imageUrl: string): Promise<{requestId: string} | null> {
  const FAL_KEY = process.env.FAL_API_KEY
  if (!FAL_KEY) return null

  // Use Seedance image-to-video for cinematic product ads
  const res = await fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      duration: '10',
      resolution: '720p',
      motion_intensity: 'medium'
    })
  })
  const data = await res.json()
  return data.request_id ? { requestId: data.request_id } : null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { productName, productDescription, productUrl, whereToBy, style, voiceStyle, clientId } = body

  if (!productName) return NextResponse.json({ error: 'Product name required' }, { status: 400 })

  // Step 1: Write ad script
  const scriptPrompt = `Write a compelling 30-45 second product advertisement voiceover script for "${productName}".
${productDescription ? `Description: ${productDescription}` : ''}
${productUrl ? `URL: ${productUrl}` : ''}
${whereToBy ? `Where to buy: ${whereToBy}` : ''}
Style: ${style || 'Professional'}. Voice: ${voiceStyle || 'Confident'}.
Search online if needed. Return ONLY the script, 60-80 words, strong hook, key benefits, CTA.`

  const script = (await claudeSearch(scriptPrompt, 300)) ||
    `Introducing ${productName}. ${productDescription || 'The product that changes everything'}. Premium quality, built for people who demand the best. Get yours now at ${whereToBy || 'the link below'}.`

  // Step 2: Generate product image with fal.ai Flux
  const imagePrompt = `Professional product photography of ${productName}. ${productDescription || ''}. Studio lighting, clean background, commercial quality, ultra realistic.`
  const productImageUrl = await generateImage(imagePrompt)

  // Step 3: Generate video with Seedance via fal.ai
  const videoPrompt = `Cinematic slow motion product advertisement. ${productName}. ${style || 'Professional and elegant'}. Smooth camera movement, dramatic lighting.`
  const videoJob = await generateVideo(videoPrompt, productImageUrl)

  // Save to DB
  if (clientId && videoJob) {
    try {
      await sb.from('client_videos').insert({
        client_id: clientId,
        title: `Cinematic Ad: ${productName}`,
        heygen_video_id: videoJob.requestId,
        status: 'processing',
        type: 'cinematic_ad',
        script
      })
    } catch {}
  }

  return NextResponse.json({
    requestId: videoJob?.requestId,
    script,
    productImage: productImageUrl,
    status: videoJob ? 'processing' : 'image_only',
    message: videoJob ? 'Video generating — check back in 2-3 minutes' : 'Image generated — video generation unavailable'
  })
}

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get('id')
  if (!requestId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const FAL_KEY = process.env.FAL_API_KEY
  if (!FAL_KEY) return NextResponse.json({ status: 'failed' })

  const res = await fetch(`https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video/requests/${requestId}`, {
    headers: { 'Authorization': `Key ${FAL_KEY}` }
  })
  const data = await res.json()

  const status = data.status === 'COMPLETED' ? 'completed' : data.status === 'FAILED' ? 'failed' : 'processing'
  const videoUrl = data.video?.url || null

  if (status === 'completed' && videoUrl) {
    try {
      await sb.from('client_videos').update({ status: 'completed', video_url: videoUrl })
        .eq('heygen_video_id', requestId)
    } catch {}
  }

  return NextResponse.json({ status, videoUrl })
}

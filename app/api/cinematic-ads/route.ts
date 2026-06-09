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

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { productName, productDescription, productUrl, whereToBy, style, voiceStyle, clientId } = body

  if (!productName) {
    return NextResponse.json({ error: 'Product name required' }, { status: 400 })
  }

  // Generate ad script
  const scriptPrompt = `Write a compelling 30-45 second product advertisement voiceover script for "${productName}".
${productDescription ? `Description: ${productDescription}` : ''}
${productUrl ? `URL: ${productUrl}` : ''}
${whereToBy ? `Where to buy: ${whereToBy}` : ''}
Style: ${style || 'Professional'}. Voice: ${voiceStyle || 'Confident'}.
Search online if needed. Return ONLY the script, 60-80 words, with strong hook, key benefits, and CTA.`

  const script = (await claudeSearch(scriptPrompt, 300)) ||
    `Introducing ${productName}. ${productDescription || 'The product that changes everything'}. Premium quality, built for people who demand the best. Don't settle for less. Get yours today at ${whereToBy || 'the link below'}.`

  // Find product image
  const imagePrompt = `Search for "${productName}"${productUrl ? ` at ${productUrl}` : ''}. Return ONLY a direct image URL (.jpg or .png), nothing else.`
  const imageText = await claudeSearch(imagePrompt, 100)
  const imgMatch = imageText.match(/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp)/i)
  const productImageUrl = imgMatch ? imgMatch[0] : 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=1280&q=80'

  // Generate HeyGen video
  const heygenRes = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: 'Tyler-incasualsuit-20220721', avatar_style: 'normal' },
        voice: { type: 'text', input_text: script, voice_id: 'f4ae3907c6e5446ea1daeab0c2f82bd5', speed: 1.0 },
        background: { type: 'image', url: productImageUrl }
      }],
      dimension: { width: 1280, height: 720 },
      aspect_ratio: '16:9'
    })
  })

  const heygenData = await heygenRes.json()
  const videoId = heygenData.data?.video_id

  if (!videoId) {
    return NextResponse.json({ error: 'Video generation failed', script, productImage: productImageUrl, fallback: true })
  }

  // Save to DB
  if (clientId) {
    await sb.from('client_videos').insert({
      client_id: clientId,
      title: `Cinematic Ad: ${productName}`,
      heygen_video_id: videoId,
      status: 'processing',
      type: 'cinematic_ad',
      script
    })
  }

  return NextResponse.json({
    videoId,
    script,
    productImage: productImageUrl,
    status: 'processing',
    message: 'Video generating — check back in 2-5 minutes'
  })
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('id')
  if (!videoId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
  })
  const data = await res.json()
  const status = data.data?.status
  const videoUrl = data.data?.video_url

  if (status === 'completed' && videoUrl) {
    await sb.from('client_videos')
      .update({ status: 'completed', video_url: videoUrl })
      .eq('heygen_video_id', videoId)
  }

  return NextResponse.json({ status, videoUrl })
}

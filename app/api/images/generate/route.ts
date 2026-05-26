import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function generateWithFal(prompt: string): Promise<string | null> {
  // Use fal.ai Flux as the image generator (fast, high quality)
  // Falls back to a placeholder if not configured
  try {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Key ' + (process.env.FAL_API_KEY || '')
      },
      body: JSON.stringify({ prompt, num_images: 1, image_size: 'square_hd', num_inference_steps: 4 })
    })
    const data = await res.json()
    return data.images?.[0]?.url || null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const { clientId, description, type, style } = await req.json()

  // Verify active subscription
  if (clientId) {
    const { data: clientRec } = await sb.from('clients').select('is_active').eq('id', clientId).single()
    if (!clientRec?.is_active) {
      const { data: activeSub } = await sb.from('wovo_subscriptions').select('status').eq('client_id', clientId).eq('status','active').maybeSingle()
      if (!activeSub) return NextResponse.json({ error: 'Active subscription required', upgrade: true }, { status: 403 })
    }
  }

  // Get business context
  let businessName = 'business'
  let profileCtx = ''
  try {
    const { data: c } = await sb.from('clients').select('business_name').eq('id', clientId).single()
    businessName = (c as any)?.business_name || businessName
    const { data: p } = await sb.from('client_business_profiles').select('*').eq('client_id', clientId).single()
    if (p) profileCtx = `Industry: ${p.industry || ''}, Style: ${p.brand_voice || ''}`
  } catch {}

  // Use Claude to write a better image prompt
  const promptRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a detailed image generation prompt for this business ad.

Business: ${businessName}
${profileCtx}
Description: ${description}
Type: ${type || 'ad'} (food ad / product ad / announcement / promotional)
Style: ${style || 'modern, professional, vibrant'}

Requirements:
- Photo-realistic commercial photography style
- Clean, professional composition
- Appetizing/appealing presentation
- Good lighting
- No text or logos in the image (we'll add those separately)
- Suitable for social media advertising

Return ONLY the image prompt, nothing else. Max 100 words.`
      }]
    })
  })
  const promptData = await promptRes.json()
  const imagePrompt = promptData.content?.[0]?.text?.trim() || description

  // Generate image
  const imageUrl = await generateWithFal(imagePrompt)

  // Generate caption via Claude
  const captionRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Write a social media caption for ${businessName}. The image shows: ${description}. Keep it punchy, 1-2 sentences + 3-5 hashtags. No quotes, just the caption.`
      }]
    })
  })
  const capData = await captionRes.json()
  const caption = capData.content?.[0]?.text?.trim() || ''

  // Save to DB
  if (clientId) {
    await sb.from('client_images').insert({
      client_id: clientId,
      prompt: description,
      image_url: imageUrl || 'pending',
      type: type || 'ad',
      caption,
    })
  }

  return NextResponse.json({ imageUrl, caption, prompt: imagePrompt })
}

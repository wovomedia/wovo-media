import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const VOICE_ID = 'f4ae3907c6e5446ea1daeab0c2f82bd5'
const BG_URL = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80'

export async function POST(req: NextRequest) {
  const { url, clientId, avatarId, customInstructions } = await req.json()

  // Get business profile for context
  let profile: any = null
  let businessName = 'this business'
  try {
    const { data: c } = await sb.from('clients').select('business_name').eq('id', clientId).single()
    businessName = (c as any)?.business_name || businessName
    const { data: p } = await sb.from('client_business_profiles').select('*').eq('client_id', clientId).single()
    profile = p
  } catch {}

  const profileCtx = profile ? `
Business: ${businessName}
Industry: ${profile.industry || ''}
Products/services: ${profile.top_products || ''}
Target audience: ${profile.target_audience || ''}
Brand voice: ${profile.brand_voice || 'casual and engaging'}
What makes them different: ${profile.differentiators || ''}` : `Business: ${businessName}`

  // Use Claude to analyze the URL and generate a remixed script
  const prompt = `You are a viral social media content strategist. Analyze this video URL and create a remixed version for a specific business.

Video URL: ${url}
${customInstructions ? `Special instructions: ${customInstructions}` : ''}

${profileCtx}

Based on the video URL (TikTok/YouTube/Instagram), I want you to:
1. Identify what makes it viral (the hook, format, structure, trend)
2. Rewrite it completely for this business

Create a 30-60 second video script that:
- Uses the SAME viral hook/format/energy as the original
- But sells/promotes ${businessName} instead
- Matches their brand voice and audience
- Feels natural and authentic, not forced
- Has a strong opening hook (first 3 seconds are critical)
- Includes a clear call to action

Return JSON with this exact format:
{
  "analysis": "What makes the original viral (1-2 sentences)",
  "hook": "The opening line (first 3 seconds)",
  "script": "Full 30-60 second script",
  "caption": "Social media caption with hashtags",
  "tips": ["Filming tip 1", "Filming tip 2", "Filming tip 3"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
  })

  const data = await res.json()
  const raw = data.content?.[0]?.text?.trim() || '{}'

  let result: any = {}
  try {
    const clean = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim()
    result = JSON.parse(clean)
  } catch { result = { script: raw, hook: '', analysis: '', caption: '', tips: [] } }

  // If avatarId provided, generate the video automatically
  let videoId = null
  if (avatarId && result.script) {
    const heyRes = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_inputs: [{
          character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
          voice: { type: 'text', input_text: result.script, voice_id: VOICE_ID, speed: 1.0 },
          background: { type: 'image', url: BG_URL }
        }],
        dimension: { width: 1080, height: 1920 }, // vertical for TikTok
      })
    })
    const heyData = await heyRes.json()
    videoId = heyData.data?.video_id

    if (videoId && clientId) {
      await sb.from('client_videos').insert({
        client_id: clientId,
        script: result.script,
        caption: result.caption,
        heygen_video_id: videoId,
        status: 'generating',
      })
      // Deduct 1 credit
      await sb.from('client_credits').upsert({ client_id: clientId, balance: 0 }, { onConflict: 'client_id' })
      try { await sb.rpc('deduct_credit', { p_client_id: clientId }) } catch {}
    }
  }

  return NextResponse.json({ ...result, videoId })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { videoDbId, script, clientId } = await req.json()

  // Get client info for context
  const { data: client } = await sb.from('clients').select('business_name').eq('id', clientId).single()
  const businessName = client?.business_name || 'this business'

  // Generate caption via Claude
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Write a social media caption for this video for ${businessName}.

Video script: "${script}"

Requirements:
- 2-3 sentences max, punchy and engaging
- Include 3-5 relevant hashtags at the end
- Match the energy/tone of the script
- Don't start with "I" or "We"
- Make it feel authentic, not corporate
- No quotes, just the caption text

Reply with ONLY the caption, nothing else.`
      }]
    })
  })

  const data = await res.json()
  const caption = data.content?.[0]?.text?.trim()

  if (caption && videoDbId) {
    await sb.from('client_videos').update({ caption }).eq('id', videoDbId)
  }

  return NextResponse.json({ caption })
}

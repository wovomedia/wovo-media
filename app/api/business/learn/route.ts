import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, currentProfile, businessName, history } = await req.json()

  const system = `You are a friendly business intake specialist for Wovo Media, a digital marketing agency. Your job is to learn about a client's business through natural conversation and extract key information.

Business name: ${businessName || 'unknown'}
Current profile data: ${JSON.stringify(currentProfile)}

Your goals:
1. Ask friendly follow-up questions to learn more
2. Extract business info from their responses
3. Keep the conversation natural, not like a form

IMPORTANT: At the end of every response, include a JSON block with any profile fields you learned. Use this exact format:
<updates>
{"field": "value", "field2": "value2"}
</updates>

Available fields: business_name, industry, location, founded_year, tagline, description, target_audience, top_products, differentiators, brand_voice, avoid_topics, goals, social_handles, website

If you didn't learn anything new to extract, still include <updates>{}</updates>

Keep responses short (2-3 sentences max) and conversational. Ask ONE follow-up question.`

  const messages = [
    ...history.map((m: any) => ({ role: m.r === 'user' ? 'user' : 'assistant', content: m.t })),
    { role: 'user', content: message }
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system,
      messages
    })
  })

  const data = await res.json()
  const fullText = data.content?.[0]?.text || ''

  // Extract updates JSON
  const updatesMatch = fullText.match(/<updates>([\s\S]*?)<\/updates>/)
  let updates = {}
  if (updatesMatch) {
    try { updates = JSON.parse(updatesMatch[1].trim()) } catch {}
  }

  // Clean reply (remove the updates block)
  const reply = fullText.replace(/<updates>[\s\S]*?<\/updates>/g, '').trim()

  return NextResponse.json({ reply, updates })
}

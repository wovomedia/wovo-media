import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { businessName, seriesName, theme, tone, businessDesc, episodes, characters } = await req.json()

  const charStr = characters?.length > 0
    ? `The scripts will feature these characters: ${characters.join(', ')}.`
    : ''

  const prompt = `Write ${episodes} short social media video scripts for ${businessName || 'a local business'}.

Series name: "${seriesName}"
Theme: ${theme}
Tone: ${tone}
${businessDesc ? `Business info: ${businessDesc}` : ''}
${charStr}

Requirements:
- Each script is 50-80 words of natural spoken dialogue
- Scripts feel authentic and conversational, not corporate
- Each episode stands alone but fits the series theme
- ${characters?.length > 1 ? 'Rotate which character is speaking — mention their name/role naturally' : 'Written from the perspective of the business owner/team'}
- End each script with a subtle call to action (follow, visit, try, check us out, etc.)

Return ONLY a valid JSON array of ${episodes} script strings. No other text, no markdown, just the JSON array.
Example format: ["Script one text here.", "Script two text here."]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await res.json()
  const raw = data.content?.[0]?.text?.trim() || '[]'

  try {
    const clean = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim()
    const scripts = JSON.parse(clean)
    return NextResponse.json({ scripts: Array.isArray(scripts) ? scripts : [scripts] })
  } catch {
    return NextResponse.json({ scripts: [raw], error: 'Parse warning' })
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { businessName, type, location, tagline, style } = await req.json()

  const styleGuide = {
    modern: 'clean white background, subtle shadows, Inter font, minimal design, lots of whitespace',
    bold: 'dark background, vibrant accent colors, large bold typography, high contrast',
    minimal: 'pure white, black text, no decoration, ultra clean, generous spacing',
    warm: 'warm cream background, earthy tones, friendly rounded corners, welcoming feel'
  }[style as string] || 'modern clean design'

  const prompt = `Create a complete, beautiful, single-page HTML website for a business. Return ONLY the full HTML — no explanation, no markdown, just the HTML document.

Business Details:
- Name: ${businessName}
- Type: ${type}
- Location: ${location || 'Local business'}
- Tagline: ${tagline || 'Serving the community'}
- Style: ${styleGuide}

Requirements:
- Complete HTML5 document with embedded CSS and minimal JS
- Professional hero section with business name and tagline
- Services/offerings section (infer from business type)
- About section 
- Contact/location section
- Mobile responsive
- Modern, polished design matching the style guide
- Use placeholder phone: (555) 000-0000 and placeholder email: info@${businessName.toLowerCase().replace(/\s+/g,'')}.com
- DO NOT mention Claude, Wovo AI, or any AI tools
- Make it look like a real, professionally designed website
- Include a call to action button`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    let html = data.content?.[0]?.text || ''
    // Strip any markdown code fences
    html = html.replace(/^```html?\n?/i,'').replace(/\n?```$/,'').trim()
    return NextResponse.json({ html })
  } catch(e) {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

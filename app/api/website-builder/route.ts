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
- DO NOT mention Claude, AI, or AI tools anywhere visible
- Make it look like a real, professionally designed website
- Include a call to action button
- At the very bottom of the page, add a footer with this exact text: 'Built by <a href="https://wovomedia.com" target="_blank" style="color:inherit;text-decoration:none;font-weight:600;">Wovo Media</a>' — style it subtly, small text, muted color, centered`

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
    // Inject Wovo Media watermark before </body> if not already present
    const watermark = `<div style="text-align:center;padding:12px;font-size:11px;color:#999;border-top:1px solid rgba(0,0,0,0.06);margin-top:0;">Built by <a href="https://wovomedia.com" target="_blank" style="color:#00E5C8;text-decoration:none;font-weight:600;">Wovo Media</a></div>`
    if (!html.includes('wovomedia.com')) {
      html = html.replace('</body>', watermark + '</body>')
    }
    return NextResponse.json({ html })
  } catch(e) {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

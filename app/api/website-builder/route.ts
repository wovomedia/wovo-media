import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { clientId } = body

  // Verify subscription if clientId provided
  if (clientId) {
    const { data: client } = await sb.from('clients').select('is_active, plan').eq('id', clientId).single()
    if (!client?.is_active) {
      return NextResponse.json({ error: 'Active subscription required', upgrade: true }, { status: 403 })
    }
  }
  const {
    // Step 1 - basics
    businessName, businessType, location, tagline, style,
    // Step 2 - details  
    description, phone, email, address, hours,
    currentWebsite, instagram, facebook, tiktok, youtube, google,
    // Step 3 - content
    pages, staffMembers, menuItems, services, testimonials,
    // Step 4 - branding
    logoUrl, primaryColor, aboutStory,
    // research data
    researchData
  } = body

  // Build the full prompt with all collected info
  const prompt = `You are an expert web developer. Create a complete, professional, beautiful single-page HTML website for this business.

BUSINESS INFO:
Name: ${businessName}
Type: ${businessType}
Location: ${location}
Tagline: ${tagline}
Phone: ${phone || 'not provided'}
Email: ${email || 'not provided'}
Address: ${address || location}
Hours: ${hours || 'not provided'}
About: ${description || aboutStory || 'a great local business'}
Style preference: ${style}

ONLINE PRESENCE:
Current website: ${currentWebsite || 'none'}
Instagram: ${instagram || 'none'}
Facebook: ${facebook || 'none'}
TikTok: ${tiktok || 'none'}
YouTube: ${youtube || 'none'}
Google Business: ${google || 'none'}

${staffMembers ? `TEAM MEMBERS:\n${staffMembers}` : ''}
${menuItems ? `MENU / PRODUCTS:\n${menuItems}` : ''}
${services ? `SERVICES:\n${services}` : ''}
${testimonials ? `TESTIMONIALS / REVIEWS:\n${testimonials}` : ''}
${pages ? `PAGES / SECTIONS REQUESTED:\n${pages}` : ''}
${researchData ? `ADDITIONAL RESEARCH FOUND ONLINE:\n${researchData}` : ''}

DESIGN REQUIREMENTS:
${style === 'Bold & Vibrant' ? 'Use bold typography, strong colors, high energy design' :
  style === 'Minimal' ? 'Clean white space, minimal elements, elegant typography' :
  style === 'Warm & Friendly' ? 'Warm tones, approachable fonts, inviting imagery' :
  style === 'Luxury' ? 'Dark backgrounds, gold accents, premium feel' :
  'Modern clean design, professional, polished'}

TECHNICAL REQUIREMENTS:
- Complete single HTML file with embedded CSS and JS
- Mobile-responsive with media queries
- Smooth scroll navigation
- Clean modern fonts from Google Fonts
- Sections: Hero, About, ${pages?.includes('Menu') || menuItems ? 'Menu/Products,' : ''} ${services ? 'Services,' : ''} ${staffMembers ? 'Team,' : ''} Contact, Footer
- Include all social media links provided
- Real phone numbers and addresses clickable (tel: and maps links)
- NO placeholder text - everything real based on the info provided
- Beautiful hover effects and transitions
- At the very bottom of the page footer, small subtle text: Built by <a href="https://wovomedia.com" style="color:inherit;opacity:0.6;text-decoration:none;">Wovo Media</a>

Return ONLY the complete HTML file. No explanations. No markdown. Just the HTML starting with <!DOCTYPE html>`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await res.json()
  let html = data.content?.[0]?.text?.trim() || ''
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/, '').trim()

  // Inject watermark if missing
  if (!html.includes('wovomedia.com')) {
    html = html.replace('</body>', '<div style="text-align:center;padding:10px;font-size:11px;color:#999;border-top:1px solid rgba(0,0,0,0.1)">Built by <a href="https://wovomedia.com" target="_blank" style="color:#00E5C8;text-decoration:none;font-weight:600;">Wovo Media</a></div></body>')
  }

  return NextResponse.json({ html })
}

// Research endpoint - use Claude web search to find info about the business
export async function GET(req: NextRequest) {
  const businessName = req.nextUrl.searchParams.get('name')
  const location = req.nextUrl.searchParams.get('location')
  if (!businessName) return NextResponse.json({ research: '' })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search for information about "${businessName}" ${location ? `in ${location}` : ''}. Find their: phone number, address, hours, services/menu items, description, social media handles, reviews/testimonials. Return a concise summary of what you found. If nothing found, say "No information found online."`
      }]
    })
  })
  const data = await res.json()
  const research = data.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') || ''
  return NextResponse.json({ research })
}

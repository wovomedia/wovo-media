import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Generate individual component files via Claude
async function generateComponent(name: string, prompt: string): Promise<string> {
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
  let code = data.content?.[0]?.text?.trim() || ''
  return code.replace(/^```(?:tsx?|jsx?|javascript|typescript)?\n?/i, '').replace(/\n?```$/,'').trim()
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { clientId, businessName, businessType, location, tagline, style,
    description, phone, email, address, hours,
    currentWebsite, instagram, facebook, tiktok, youtube, google,
    pages, staffMembers, menuItems, services, testimonials,
    logoUrl, aboutStory, researchData } = body

  if (clientId) {
    const { data: client } = await sb.from('clients').select('is_active, plan').eq('id', clientId).single()
    if (!client?.is_active) return NextResponse.json({ error: 'Active subscription required', upgrade: true }, { status: 403 })
  }

  const businessInfo = `
Business: ${businessName}
Type: ${businessType}
Location: ${location}
Tagline: ${tagline || ''}
Phone: ${phone || ''}
Email: ${email || ''}
Address: ${address || location}
Hours: ${hours || ''}
About: ${description || aboutStory || ''}
Style: ${style}
Instagram: ${instagram || ''}
Facebook: ${facebook || ''}
TikTok: ${tiktok || ''}
YouTube: ${youtube || ''}
Staff: ${staffMembers || ''}
Menu/Products: ${menuItems || ''}
Services: ${services || ''}
Testimonials: ${testimonials || ''}
Research: ${researchData || ''}`

  const styleGuide = style === 'Bold & Vibrant' ? 'Bold typography, vibrant colors, high energy' :
    style === 'Minimal' ? 'Clean whitespace, minimal elements, elegant' :
    style === 'Warm & Friendly' ? 'Warm tones, approachable, inviting' :
    style === 'Luxury' ? 'Dark backgrounds, gold accents, premium feel' :
    style === 'Fun & Playful' ? 'Playful fonts, bright colors, fun animations' :
    'Modern, clean, professional'

  const sharedContext = `You are building a professional Next.js website for this business. Return ONLY the component code, no explanations.
Style guide: ${styleGuide}
Business info: ${businessInfo}
Use Tailwind CSS classes only. No external CSS imports. No placeholder text - use real business data only.`

  // Generate all components in parallel
  const [navCode, heroCode, aboutCode, servicesCode, contactCode, footerCode, layoutCode, menuCode] = await Promise.all([

    generateComponent('Nav', `${sharedContext}

Create a Nav component for this business website.
- Logo on left (business name styled beautifully)
- Navigation links for the site sections
- Mobile hamburger menu with useState
- Sticky, glass morphism effect (backdrop-blur)
- Smooth scroll to sections on click
- Export default function Nav()`),

    generateComponent('Hero', `${sharedContext}

Create a Hero section component.
- Full viewport height, visually stunning
- Business name, tagline prominently displayed
- Call to action button (call now / book / order)
- Beautiful background (gradient or pattern using Tailwind)
- Subtle animation on load (use CSS animate classes)
- Export default function Hero()`),

    generateComponent('About', `${sharedContext}

Create an About section component.
- Section id="about"
- Business story, what makes them special
- Clean grid layout, compelling copy
- If staff members provided, show team cards with name/role
- Export default function About()`),

    generateComponent('Services', `${sharedContext}

Create a Services/Products section component.
- Section id="services"  
- Display services or menu items as beautiful cards
- Prices if provided, icons using emoji
- Grid layout, responsive
- Export default function Services()`),

    generateComponent('Contact', `${sharedContext}

Create a Contact section component.
- Section id="contact"
- Phone number (clickable tel: link), email, address
- Business hours displayed cleanly
- Social media links if provided (Instagram, Facebook, TikTok, YouTube)
- Simple contact form (name, email, message fields - no backend needed, just UI)
- Google Maps embed iframe if address provided
- Export default function Contact()`),

    generateComponent('Footer', `${sharedContext}

Create a Footer component.
- Business name, tagline
- Quick nav links
- Social links if provided
- Copyright line
- Small text at bottom: Built by <a href="https://wovomedia.com" className="text-current opacity-60 hover:opacity-100">Wovo Media</a>
- Export default function Footer()`),

    generateComponent('Layout', `${sharedContext}

Create the main layout/page file that imports and uses all components.
This is the complete page. Import: Nav, Hero, About, Services, Contact, Footer from './components/'.
- import Nav from './components/Nav'
- import Hero from './components/Hero'  
- import About from './components/About'
- import Services from './components/Services'
- import Contact from './components/Contact'
- import Footer from './components/Footer'
Render them all in order. Add smooth scroll behavior.
Export default function Home()`),

    // Only generate menu component if menu items exist
    menuItems ? generateComponent('Menu', `${sharedContext}

Create a Menu/Products section component specifically for the menu items provided.
- Section id="menu"
- Beautiful menu card layout
- Category grouping if applicable
- Prices displayed clearly
- Export default function Menu()`) : Promise.resolve(''),
  ])

  // Build the file structure
  const files: Record<string, string> = {
    'page.tsx': layoutCode,
    'components/Nav.tsx': navCode,
    'components/Hero.tsx': heroCode,
    'components/About.tsx': aboutCode,
    'components/Services.tsx': servicesCode,
    'components/Contact.tsx': contactCode,
    'components/Footer.tsx': footerCode,
    'tailwind.config.js': `module.exports = { content: ['./**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }`,
    'package.json': JSON.stringify({
      name: businessName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { next: '14.2.0', react: '^18', 'react-dom': '^18' },
      devDependencies: { tailwindcss: '^3', autoprefixer: '^10', postcss: '^8', typescript: '^5', '@types/react': '^18', '@types/node': '^20' }
    }, null, 2),
    'README.md': `# ${businessName} Website\n\nBuilt by [Wovo Media](https://wovomedia.com)\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000)\n\n## Built With\n- Next.js 14\n- Tailwind CSS\n- TypeScript`
  }

  if (menuItems && menuCode) {
    files['components/Menu.tsx'] = menuCode
    // Update page to include Menu
    files['page.tsx'] = files['page.tsx']
      .replace("import Contact", "import Menu from './components/Menu'\nimport Contact")
      .replace('<Contact', '<Menu />\n      <Contact')
  }

  return NextResponse.json({ files, businessName })
}

// Research endpoint
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
      messages: [{ role: 'user', content: `Search for "${businessName}" ${location ? `in ${location}` : ''}. Find phone, address, hours, services, social media. Return a brief summary.` }]
    })
  })
  const data = await res.json()
  const research = data.content?.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') || ''
  return NextResponse.json({ research })
}

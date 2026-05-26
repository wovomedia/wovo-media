import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const AD_SCRIPTS = {
  awareness: `If your business isn't showing up online, you're losing customers every single day. That's exactly why we built Wovo Media. We create content for local businesses using AI — posts, videos, captions — all done for you. Restaurants, boutiques, service businesses — businesses just like yours are getting millions of views every month with Wovo AI. And it starts at just twenty-nine dollars a month. No filming. No editing. No stress. Just consistent, professional content that grows your business. Go to wovomedia dot com and start today.`,
  
  demo: `Let me show you exactly how Wovo AI works. You go to wovomedia dot com, click "Find my plan," answer a few quick questions, and our AI guide Nova recommends the perfect plan for your business. Then you create your AI character — either clone your own face and voice, or pick a stock avatar. Next, you choose a video series — tips, behind the scenes, promos — whatever fits your brand. Our AI writes the scripts, generates the videos, and creates captions ready to copy and post. You get professional social media content every single week with zero effort. Try it at wovomedia dot com.`,
  
  conversion: `Here's a question. How much is one new customer worth to your business? Twenty dollars? Two hundred? Two thousand? Wovo AI gets you in front of hundreds of new people every week for twenty-nine dollars a month. That's less than a tank of gas. Our clients are hitting four million views a month. One restaurant we manage went from zero online presence to fully booked weekends in sixty days. This isn't magic — it's just consistent content, done right, every week. If you're ready to actually grow your business online, go to wovomedia dot com right now. Starter plan is twenty-nine a month. Growth is forty-nine for your whole team. Or book a free strategy call and we'll build a custom plan just for you. Don't wait — your competitors are already doing this.`,

  hook_tiktok: `POV: your competitor just got four million views this month and you've posted twice. That's the difference between having Wovo AI and not having it. We build an AI character for your business — your face, your voice — that posts content for you every single week while you run your business. Twenty-nine dollars a month. Go to wovomedia dot com.`,
}

export async function POST(req: NextRequest) {
  const { type = 'demo' } = await req.json()

  const script = AD_SCRIPTS[type as keyof typeof AD_SCRIPTS] || AD_SCRIPTS.demo
  const AVATAR_ID = 'Tyler-incasualsuit-20220721'
  const VOICE_ID = 'f4ae3907c6e5446ea1daeab0c2f82bd5'
  const BG_URL = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80'

  // Check if already generated
  let existing: any = null
  try {
    const { data } = await sb.from('nova_videos').select('*').eq('node_id', `ad_${type}`).single()
    existing = data
  } catch {}

  if (existing?.status === 'completed' && existing?.video_url) {
    return NextResponse.json({ videoUrl: existing.video_url, script, cached: true })
  }

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal' },
        voice: { type: 'text', input_text: script, voice_id: VOICE_ID, speed: 1.0 },
        background: { type: 'image', url: BG_URL }
      }],
      dimension: { width: 1920, height: 1080 }, // landscape for ads
    })
  })

  const data = await res.json()
  const videoId = data.data?.video_id
  if (!videoId) return NextResponse.json({ error: data.error || 'Failed', script }, { status: 500 })

  await sb.from('nova_videos').upsert({ node_id: `ad_${type}`, heygen_video_id: videoId, status: 'generating' })
  return NextResponse.json({ videoId, script, status: 'generating' })
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'demo'
  const videoId = req.nextUrl.searchParams.get('id')

  if (videoId) {
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const data = await res.json()
    const status = data.data?.status
    const videoUrl = data.data?.video_url
    if (status === 'completed' && videoUrl) {
      await sb.from('nova_videos').update({ status: 'completed', video_url: videoUrl, completed_at: new Date().toISOString() }).eq('node_id', `ad_${type}`)
    }
    return NextResponse.json({ status, videoUrl })
  }

  // Return all ad scripts
  return NextResponse.json({ scripts: AD_SCRIPTS })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Default avatar + voice IDs (public HeyGen avatars)
const DEFAULT_AVATAR = 'Angela-inblackskirt-20220820'
const DEFAULT_VOICE  = '2d5b0e6cf36f460aa7fc47e3eee4ba54'

export async function POST(req: NextRequest) {
  const { type, clientId, businessName, ownerName, views, engagements, posts, summary, script: customScript, avatarId, voiceId } = await req.json()

  let script = customScript

  if (!script) {
    if (type === 'welcome') {
      script = `Hey ${ownerName || 'there'}! Welcome to Wovo Media. We are so excited to start working with ${businessName || 'your business'}. Over the next few days, we will be setting up your account, building your content strategy, and getting everything ready to grow your online presence. If you have any questions at all, don't hesitate to reach out. We're here for you every step of the way. Let's get started!`
    } else if (type === 'report') {
      script = `Hey ${ownerName || 'there'}! Here's your monthly recap for ${businessName || 'your business'}. This month you hit ${views?.toLocaleString() || '0'} views and ${engagements?.toLocaleString() || '0'} engagements across your social media. We published ${posts || 0} posts this month. ${summary || 'Keep up the great work — we are seeing real momentum building for your brand.'} See you next month!`
    } else {
      return NextResponse.json({ error: 'No script provided' }, { status: 400 })
    }
  }

  // Generate video via HeyGen v2
  const body = {
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatarId || DEFAULT_AVATAR,
        avatar_style: 'normal'
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voiceId || DEFAULT_VOICE,
      },
      background: {
        type: 'color',
        value: '#0d0d0d'
      }
    }],
    dimension: { width: 1280, height: 720 },
    aspect_ratio: '16:9',
  }

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  if (data.error) return NextResponse.json({ error: data.error }, { status: 400 })

  const videoId = data.data?.video_id
  if (!videoId) return NextResponse.json({ error: 'No video ID returned' }, { status: 500 })

  // Save to DB if client context provided
  if (clientId) {
    await sb.from('client_reports').update({ video_id: videoId }).eq('client_id', clientId).order('created_at', { ascending: false }).limit(1)
  }

  return NextResponse.json({ videoId, status: 'processing' })
}

import { NextRequest, NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const AVATAR_ID = 'Daisy-inskirt-20220818'
// Pro Confident Male voice
const VOICE_ID = 'f4ae3907c6e5446ea1daeab0c2f82bd5'
const BG_URL = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1280&q=80'

export async function POST(req: NextRequest) {
  const { nodeId } = await req.json()
  const node = NOVA_FLOW[nodeId]
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  // Check Supabase cache first - persists across deploys and all users
  const { data: cached } = await sb.from('nova_videos').select('*').eq('node_id', nodeId).single()

  if (cached?.status === 'completed') {
    // Always prefer permanent Supabase URL - never expires
    if (cached?.permanent_url) {
      return NextResponse.json({ videoId: cached.heygen_video_id, videoUrl: cached.permanent_url, cached: true, permanent: true })
    }
    // Check if URL is stale (HeyGen URLs expire in 7 days)
    const age = cached.completed_at ? Date.now() - new Date(cached.completed_at).getTime() : 0
    const sixDays = 6 * 24 * 60 * 60 * 1000
    if (age < sixDays) {
      return NextResponse.json({ videoId: cached.heygen_video_id, videoUrl: cached.video_url, cached: true })
    }
    // Refresh URL from HeyGen
    try {
      const refresh = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${cached.heygen_video_id}`, {
        headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
      })
      const rData = await refresh.json()
      const newUrl = rData.data?.video_url
      if (newUrl) {
        await sb.from('nova_videos').update({ video_url: newUrl, completed_at: new Date().toISOString() }).eq('node_id', nodeId)
        return NextResponse.json({ videoId: cached.heygen_video_id, videoUrl: newUrl, cached: true })
      }
    } catch {}
    // If refresh fails, still serve old URL
    return NextResponse.json({ videoId: cached.heygen_video_id, videoUrl: cached.video_url, cached: true })
  }

  // If already generating (pending), return the video ID so frontend can poll
  if (cached?.status === 'generating' && cached?.heygen_video_id) {
    return NextResponse.json({ videoId: cached.heygen_video_id, cached: false })
  }

  // Generate new video
  const body = {
    video_inputs: [{
      character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal' },
      voice: { type: 'text', input_text: node.script, voice_id: VOICE_ID, speed: 1.0 },
      background: { type: 'image', url: BG_URL }
    }],
    dimension: { width: 854, height: 480 },
  }

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  const videoId = data.data?.video_id

  if (!videoId) {
    return NextResponse.json({ error: data.error || data.message || 'HeyGen generation failed', raw: data }, { status: 500 })
  }

  // Save to Supabase as generating
  await sb.from('nova_videos').upsert({
    node_id: nodeId,
    heygen_video_id: videoId,
    status: 'generating',
  })

  return NextResponse.json({ videoId, cached: false })
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('id')
  const nodeId = req.nextUrl.searchParams.get('node')
  if (!videoId) return NextResponse.json({ error: 'No ID' }, { status: 400 })

  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
  })
  const data = await res.json()
  const status = data.data?.status
  const videoUrl = data.data?.video_url

  // If completed, save URL to Supabase so it's cached forever
  if (status === 'completed' && videoUrl && nodeId) {
    await sb.from('nova_videos').upsert({
      node_id: nodeId,
      heygen_video_id: videoId,
      video_url: videoUrl,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ status, videoUrl, error: data.data?.error })
}

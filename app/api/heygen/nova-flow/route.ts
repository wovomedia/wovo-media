import { NextRequest, NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'

const videoCache: Record<string, string> = {}

// Tyler avatar - professional male in suit
// Using his recommended matched voice for natural lip sync
const AVATAR_ID = 'Tyler-insuit-20220721'
// Tyler's default matched voice (American male, professional tone)
const VOICE_ID = '2d5b0e6cf36f460aa7fc47e3eee4ba54'

export async function POST(req: NextRequest) {
  const { nodeId } = await req.json()
  const node = NOVA_FLOW[nodeId]
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  if (videoCache[nodeId]) {
    return NextResponse.json({ videoId: videoCache[nodeId], cached: true })
  }

  // First, fetch Tyler's actual default_voice_id to ensure lip sync match
  let voiceId = VOICE_ID
  try {
    const avatarRes = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const avatarData = await avatarRes.json()
    const tyler = avatarData?.data?.avatars?.find((a: any) => a.avatar_id === AVATAR_ID)
    if (tyler?.default_voice_id) voiceId = tyler.default_voice_id
  } catch {}

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: AVATAR_ID,
          avatar_style: 'normal'
        },
        voice: {
          type: 'text',
          input_text: node.script,
          voice_id: voiceId,
          speed: 1.0,
        },
        background: {
          type: 'color',
          value: '#0a0a0a'
        }
      }],
      dimension: { width: 854, height: 480 },
      aspect_ratio: '16:9',
    })
  })

  const data = await res.json()
  const videoId = data.data?.video_id
  if (!videoId) return NextResponse.json({ error: data.error || 'Generation failed' }, { status: 500 })

  videoCache[nodeId] = videoId
  return NextResponse.json({ videoId })
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('id')
  if (!videoId) return NextResponse.json({ error: 'No ID' }, { status: 400 })

  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
  })
  const data = await res.json()
  return NextResponse.json({
    status: data.data?.status,
    videoUrl: data.data?.video_url,
    thumbnailUrl: data.data?.thumbnail_url,
  })
}

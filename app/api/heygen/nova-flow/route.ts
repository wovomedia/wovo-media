import { NextRequest, NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'

// Persistent video cache stored by node ID
// Uses a module-level Map so it survives across requests on same instance
const videoCache = new Map<string, string>()

// Tyler in Suit - confirmed avatar ID from HeyGen
const AVATAR_ID = 'Tyler-insuit-20220721'

// Office/workspace background - a clean modern office background image
// Using a publicly available office background URL
const BACKGROUND_URL = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80'

async function getTylerVoiceId(): Promise<string> {
  // Fetch Tyler's actual default voice to ensure lip sync
  try {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const data = await res.json()
    const tyler = data?.data?.avatars?.find((a: any) => a.avatar_id === AVATAR_ID)
    if (tyler?.default_voice_id) {
      console.log('Tyler default voice:', tyler.default_voice_id)
      return tyler.default_voice_id
    }
  } catch (e) {
    console.error('Failed to fetch Tyler voice:', e)
  }
  // Fallback: Pro Confident Male voice ID (common HeyGen male voice)
  return '2d5b0e6cf36f460aa7fc47e3eee4ba54'
}

export async function POST(req: NextRequest) {
  const { nodeId } = await req.json()
  const node = NOVA_FLOW[nodeId]
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  // Return cached video ID if we already generated this node
  if (videoCache.has(nodeId)) {
    return NextResponse.json({ videoId: videoCache.get(nodeId), cached: true })
  }

  const voiceId = await getTylerVoiceId()

  const body = {
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
        type: 'image',
        url: BACKGROUND_URL
      }
    }],
    dimension: { width: 854, height: 480 },
    aspect_ratio: '16:9',
  }

  console.log('Generating Nova video for node:', nodeId, 'voice:', voiceId)

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.HEYGEN_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  console.log('HeyGen response:', JSON.stringify(data))

  const videoId = data.data?.video_id
  if (!videoId) {
    return NextResponse.json({
      error: data.error || data.message || 'Generation failed',
      details: data
    }, { status: 500 })
  }

  videoCache.set(nodeId, videoId)
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
    error: data.data?.error,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'

// Cache of already-generated video IDs so we don't regenerate on every visit
const videoCache: Record<string, string> = {}

export async function POST(req: NextRequest) {
  const { nodeId } = await req.json()
  const node = NOVA_FLOW[nodeId]
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  // Check cache first
  if (videoCache[nodeId]) {
    return NextResponse.json({ videoId: videoCache[nodeId], cached: true })
  }

  // Use a consistent professional avatar + voice
  const AVATAR_ID = 'Tyler-insuit-20220721'
  const VOICE_ID  = '1bd001e7e50f421d891986aad5158bc8'

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal' },
        voice: { type: 'text', input_text: node.script, voice_id: VOICE_ID },
        background: { type: 'color', value: '#0a0a0a' }
      }],
      dimension: { width: 854, height: 480 },
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
  })
}

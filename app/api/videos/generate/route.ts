import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const VOICE_ID = 'f4ae3907c6e5446ea1daeab0c2f82bd5'
const BG_URL = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80'

export async function POST(req: NextRequest) {
  const { clientId, characterId, seriesId, script, episodeNumber, avatarId } = await req.json()
  if (!script || !clientId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  // Generate video via HeyGen
  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: avatarId || 'Tyler-incasualsuit-20220721',
          avatar_style: 'normal'
        },
        voice: { type: 'text', input_text: script, voice_id: VOICE_ID, speed: 1.0 },
        background: { type: 'image', url: BG_URL }
      }],
      dimension: { width: 1080, height: 1920 }, // vertical for social
    })
  })

  const data = await res.json()
  const videoId = data.data?.video_id
  if (!videoId) return NextResponse.json({ error: data.error || 'Generation failed' }, { status: 500 })

  // Save to DB
  const { data: video } = await sb.from('client_videos').insert({
    client_id: clientId,
    character_id: characterId,
    series_id: seriesId,
    heygen_video_id: videoId,
    script,
    status: 'generating',
    episode_number: episodeNumber,
  }).select().single()

  // Generate caption via Claude in background
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://wovomedia.com'}/api/videos/caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoDbId: video?.id, script, clientId })
  }).catch(() => {})

  return NextResponse.json({ videoId, dbId: video?.id, status: 'generating' })
}

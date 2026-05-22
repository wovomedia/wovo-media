import { NextRequest, NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AVATAR_ID = 'Tyler-incasualsuit-20220721'
const VOICE_ID = 'f4ae3907c6e5446ea1daeab0c2f82bd5'
const BG_URL = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80'

async function generateVideo(nodeId: string, script: string) {
  // Check if already done
  const { data: existing } = await sb.from('nova_videos').select('*').eq('node_id', nodeId).single()
  if (existing?.status === 'completed' && existing?.video_url) return { nodeId, status: 'already_done', url: existing.video_url }
  if (existing?.status === 'generating') return { nodeId, status: 'already_generating', videoId: existing.heygen_video_id }

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal' },
        voice: { type: 'text', input_text: script, voice_id: VOICE_ID, speed: 1.0 },
        background: { type: 'image', url: BG_URL }
      }],
      dimension: { width: 854, height: 480 },
    })
  })
  const data = await res.json()
  const videoId = data.data?.video_id
  if (!videoId) return { nodeId, status: 'error', error: data.error || data.message }

  await sb.from('nova_videos').upsert({ node_id: nodeId, heygen_video_id: videoId, status: 'generating' })
  return { nodeId, status: 'generating', videoId }
}

// Poll all generating videos and save completed ones
async function pollAll() {
  const { data: generating } = await sb.from('nova_videos').select('*').eq('status', 'generating')
  if (!generating?.length) return []

  const results = await Promise.all(generating.map(async (v) => {
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${v.heygen_video_id}`, {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const data = await res.json()
    const status = data.data?.status
    const videoUrl = data.data?.video_url
    if (status === 'completed' && videoUrl) {
      await sb.from('nova_videos').update({ status: 'completed', video_url: videoUrl, completed_at: new Date().toISOString() }).eq('node_id', v.node_id)
      return { nodeId: v.node_id, status: 'completed', url: videoUrl }
    }
    return { nodeId: v.node_id, status }
  }))
  return results
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  if (action === 'reset-failed') {
    // Delete failed AND stuck generating entries (stuck = generating for >1hr)
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    await sb.from('nova_videos').delete().eq('status', 'failed')
    await sb.from('nova_videos').delete().eq('status', 'generating').lt('created_at', cutoff)
    return NextResponse.json({ reset: true })
  }

  if (action === 'check-error') {
    // Check what error HeyGen returns for a test video
    const testRes = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_inputs: [{
          character: { type: 'avatar', avatar_id: 'Tyler-incasualsuit-20220721', avatar_style: 'normal' },
          voice: { type: 'text', input_text: 'Hello! This is a test.', voice_id: 'f4ae3907c6e5446ea1daeab0c2f82bd5', speed: 1.0 },
          background: { type: 'color', value: '#0a0a0a' }
        }],
        dimension: { width: 854, height: 480 },
      })
    })
    const testData = await testRes.json()
    return NextResponse.json({ test: testData, status: testRes.status, apiKeySet: !!process.env.HEYGEN_API_KEY })
  }

  if (action === 'poll') {
    const results = await pollAll()
    return NextResponse.json({ polled: results })
  }

  if (action === 'status') {
    const { data } = await sb.from('nova_videos').select('node_id, status, video_url, completed_at')
    return NextResponse.json({ videos: data, total: data?.length, done: data?.filter(v => v.status === 'completed').length })
  }

  // Generate a specific node or the next pending one
  const nodeParam = req.nextUrl.searchParams.get('node')

  if (nodeParam) {
    const node = NOVA_FLOW[nodeParam]
    if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    const result = await generateVideo(nodeParam, node.script)
    return NextResponse.json(result)
  }

  // Generate next pending node (one at a time to avoid timeout)
  const { data: existing } = await sb.from('nova_videos').select('node_id')
  const doneIds = new Set(existing?.map((v: any) => v.node_id) || [])
  const pending = Object.keys(NOVA_FLOW).filter(id => !doneIds.has(id))

  if (pending.length === 0) return NextResponse.json({ message: 'All videos done!', total: Object.keys(NOVA_FLOW).length })

  const nextNode = pending[0]
  const node = NOVA_FLOW[nextNode]
  const result = await generateVideo(nextNode, node.script)
  return NextResponse.json({ ...result, remaining: pending.length - 1 })
}
// Fri May 22 12:51:00 UTC 2026

import { NextRequest, NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AVATAR_ID = 'Tyler-incasualsuit-20220721'
const VOICE_ID = 'f4ae3907c6e5446ea1daeab0c2f82bd5'
const BG_URL = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80'

async function generateVideo(nodeId: string, script: string) {
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

async function refreshExpiredUrls() {
  // HeyGen URLs expire in 7 days. Refresh anything that's completed but
  // the URL was generated more than 5 days ago.
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const { data: stale } = await sb
    .from('nova_videos')
    .select('*')
    .eq('status', 'completed')
    .lt('completed_at', cutoff)

  if (!stale?.length) return { refreshed: 0 }

  // Re-fetch URLs from HeyGen using the stored video IDs
  let refreshed = 0
  for (const v of stale) {
    if (!v.heygen_video_id) continue
    try {
      const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${v.heygen_video_id}`, {
        headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
      })
      const data = await res.json()
      const newUrl = data.data?.video_url
      if (newUrl && newUrl !== v.video_url) {
        await sb.from('nova_videos').update({ video_url: newUrl, completed_at: new Date().toISOString() }).eq('node_id', v.node_id)
        refreshed++
      } else if (data.data?.status === 'failed') {
        // Need to regenerate
        const node = NOVA_FLOW[v.node_id]
        if (node) {
          await sb.from('nova_videos').delete().eq('node_id', v.node_id)
          await generateVideo(v.node_id, node.script)
          refreshed++
        }
      }
    } catch {}
  }
  return { refreshed, checked: stale.length }
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  if (action === 'refresh') {
    const result = await refreshExpiredUrls()
    return NextResponse.json(result)
  }

  if (action === 'reset-failed') {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    await sb.from('nova_videos').delete().eq('status', 'failed')
    await sb.from('nova_videos').delete().eq('status', 'generating').lt('created_at', cutoff)
    return NextResponse.json({ reset: true })
  }

  if (action === 'poll') {
    const results = await pollAll()
    return NextResponse.json({ polled: results })
  }

  if (action === 'status') {
    const { data } = await sb.from('nova_videos').select('node_id, status, completed_at').order('node_id')
    const total = Object.keys(NOVA_FLOW).length
    const done = data?.filter(v => v.status === 'completed').length || 0
    
    // Check which ones need URL refresh (older than 5 days)
    const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const needsRefresh = data?.filter(v => v.status === 'completed' && v.completed_at < cutoff).length || 0
    
    return NextResponse.json({ videos: data, total, done, needsRefresh, apiKeySet: !!process.env.HEYGEN_API_KEY })
  }

  const nodeParam = req.nextUrl.searchParams.get('node')
  if (nodeParam) {
    const node = NOVA_FLOW[nodeParam]
    if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    const result = await generateVideo(nodeParam, node.script)
    return NextResponse.json(result)
  }

  // Generate next pending node
  const { data: existing } = await sb.from('nova_videos').select('node_id')
  const doneIds = new Set(existing?.map((v: any) => v.node_id) || [])
  const pending = Object.keys(NOVA_FLOW).filter(id => !doneIds.has(id))
  if (pending.length === 0) return NextResponse.json({ message: 'All done!', total: Object.keys(NOVA_FLOW).length })
  const nextNode = pending[0]
  const node = NOVA_FLOW[nextNode]
  const result = await generateVideo(nextNode, node.script)
  return NextResponse.json({ ...result, remaining: pending.length - 1 })
}

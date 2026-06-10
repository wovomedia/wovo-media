import { NextRequest, NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const FAL_KEY = process.env.FAL_API_KEY!

async function generateWithFal(script: string, nodeId: string): Promise<string> {
  // Step 1: Generate a cinematic frame of Nova presenting
  const mood = nodeId.startsWith('close') ? 'confident warm smile, slightly leaning forward' : 
    nodeId === 'intro' ? 'energetic welcoming big smile, hands open' : 'engaged explaining, natural expression'

  const imgRes = await fetch('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Young professional male presenter 20s, curly dark brown hair, ${mood}, dark modern studio background teal rim lighting, speaking to camera, business casual, photorealistic, cinematic, sharp focus`,
      image_size: 'landscape_16_9',
      num_inference_steps: 20,
      guidance_scale: 3.5,
      num_images: 1
    })
  })
  const imgData = await imgRes.json()
  const imageUrl = imgData.images?.[0]?.url
  if (!imageUrl) throw new Error('Image gen failed')

  // Step 2: Animate with Seedance
  const motionPrompt = nodeId === 'intro' 
    ? 'Person speaking enthusiastically with natural head movement and hand gesture, welcoming, cinematic'
    : nodeId.startsWith('close')
    ? 'Person nodding confidently, direct eye contact, subtle smile, professional cinematic'
    : 'Person speaking naturally with expressive body language, engaging presentation, cinematic'

  const vidRes = await fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: motionPrompt,
      image_url: imageUrl,
      duration: '5',
      resolution: '720p',
      motion_intensity: 'medium'
    })
  })
  const vidData = await vidRes.json()
  return vidData.request_id || ''
}

export async function POST(req: NextRequest) {
  const { nodeId } = await req.json()
  const node = NOVA_FLOW[nodeId]
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  // Check cache
  const { data: cached } = await sb.from('nova_videos').select('*').eq('node_id', nodeId).maybeSingle()
  if (cached?.status === 'completed' && cached?.permanent_url) {
    return NextResponse.json({ videoUrl: cached.permanent_url, script: node.script, cached: true })
  }
  if (cached?.status === 'generating' && cached?.request_id) {
    return NextResponse.json({ requestId: cached.request_id, script: node.script, generating: true })
  }

  try {
    const requestId = await generateWithFal(node.script, nodeId)
    await sb.from('nova_videos').upsert({
      node_id: nodeId, status: 'generating', request_id: requestId, script: node.script
    }, { onConflict: 'node_id' })
    return NextResponse.json({ requestId, script: node.script, generating: true })
  } catch {
    return NextResponse.json({ error: 'Generation failed', script: node.script }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get('id')
  const nodeId = req.nextUrl.searchParams.get('node')
  if (!requestId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const res = await fetch(
    `https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video/requests/${requestId}`,
    { headers: { 'Authorization': `Key ${FAL_KEY}` } }
  )
  const data = await res.json()
  const status = data.status === 'COMPLETED' ? 'completed' : data.status === 'FAILED' ? 'failed' : 'processing'
  const videoUrl = data.video?.url || null

  if (status === 'completed' && videoUrl && nodeId) {
    try {
      const vidBuf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer())
      await sb.storage.from('client-videos').upload(`nova/${nodeId}.mp4`, vidBuf, {
        contentType: 'video/mp4', upsert: true
      })
      const { data: pub } = sb.storage.from('client-videos').getPublicUrl(`nova/${nodeId}.mp4`)
      await sb.from('nova_videos').upsert({
        node_id: nodeId, status: 'completed', request_id: requestId,
        permanent_url: pub.publicUrl, video_url: videoUrl, completed_at: new Date().toISOString()
      }, { onConflict: 'node_id' })
      return NextResponse.json({ status, videoUrl: pub.publicUrl })
    } catch {
      await sb.from('nova_videos').upsert({
        node_id: nodeId, status: 'completed', request_id: requestId, video_url: videoUrl
      }, { onConflict: 'node_id' })
    }
  }
  return NextResponse.json({ status, videoUrl })
}

import { NextResponse } from 'next/server'
import { NOVA_FLOW } from '@/lib/nova-flow'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const FAL_KEY = process.env.FAL_API_KEY!

async function startVideoJob(nodeId: string, script: string): Promise<string> {
  // Generate image first
  const mood = nodeId === 'intro' ? 'energetic big smile hands open welcoming' 
    : nodeId.startsWith('close') ? 'confident warm nodding slightly forward'
    : 'engaged natural explaining expression'

  const imgRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Young professional male 20s curly dark brown hair ${mood} dark studio teal lighting speaking to camera business casual photorealistic cinematic`,
      image_size: 'landscape_16_9', num_inference_steps: 4, num_images: 1
    })
  })
  const imgData = await imgRes.json()
  const imageUrl = imgData.images?.[0]?.url
  if (!imageUrl) return ''

  // Start Seedance job
  const vidRes = await fetch('https://queue.fal.run/fal-ai/bytedance/seedance-1-5/image-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Person speaking naturally with subtle head movement and gestures, cinematic professional presenter',
      image_url: imageUrl, duration: '5', resolution: '720p', motion_intensity: 'medium'
    })
  })
  const vidData = await vidRes.json()
  return vidData.request_id || ''
}

export async function GET() {
  const nodes = Object.keys(NOVA_FLOW)
  const results: Record<string, string> = {}

  for (const nodeId of nodes) {
    // Check if already cached
    const { data: cached } = await sb.from('nova_videos').select('status, permanent_url').eq('node_id', nodeId).maybeSingle()
    if (cached?.status === 'completed' && cached?.permanent_url) {
      results[nodeId] = 'already_cached'
      continue
    }
    if (cached?.status === 'generating') {
      results[nodeId] = 'already_generating'
      continue
    }

    try {
      const { script } = NOVA_FLOW[nodeId]
      const requestId = await startVideoJob(nodeId, script)
      if (requestId) {
        await sb.from('nova_videos').upsert({
          node_id: nodeId, status: 'generating', request_id: requestId, script
        }, { onConflict: 'node_id' })
        results[nodeId] = `queued:${requestId}`
      } else {
        results[nodeId] = 'failed'
      }
    } catch (e) {
      results[nodeId] = 'error'
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500))
  }

  return NextResponse.json({ results, total: nodes.length })
}

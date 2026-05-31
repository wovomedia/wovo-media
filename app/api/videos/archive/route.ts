import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Download a video from HeyGen URL and save to Supabase storage permanently
async function archiveVideo(videoUrl: string, bucket: string, path: string): Promise<string | null> {
  try {
    // Check if already archived
    const { data: existing } = await sb.storage.from(bucket).getPublicUrl(path)
    // Try fetching the existing file to see if it's real
    const checkRes = await fetch(existing.publicUrl, { method: 'HEAD' }).catch(() => null)
    if (checkRes?.ok) return existing.publicUrl

    // Download from HeyGen
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`)
    const buffer = await videoRes.arrayBuffer()

    // Upload to Supabase storage
    const { error } = await sb.storage.from(bucket).upload(path, buffer, {
      contentType: 'video/mp4',
      upsert: true,
      cacheControl: '31536000' // 1 year
    })
    if (error) throw error

    const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(path)
    return publicUrl
  } catch (e) {
    console.error('Archive failed:', e)
    return null
  }
}

// Archive ALL Nova videos
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('target') || 'nova'
  const videoId = req.nextUrl.searchParams.get('id') // optional - archive single video

  if (target === 'nova') {
    const query = sb.from('nova_videos').select('*').eq('status', 'completed')
    if (videoId) query.eq('node_id', videoId)
    const { data: videos } = await query

    let archived = 0, failed = 0, skipped = 0
    const results: any[] = []

    for (const video of videos || []) {
      // Skip if already archived
      if (video.permanent_url) { skipped++; continue }
      if (!video.video_url) { failed++; continue }

      const path = `nova/${video.node_id}.mp4`
      const permanentUrl = await archiveVideo(video.video_url, 'nova-videos', path)

      if (permanentUrl) {
        await sb.from('nova_videos').update({ permanent_url: permanentUrl }).eq('node_id', video.node_id)
        archived++
        results.push({ node_id: video.node_id, status: 'archived' })
      } else {
        failed++
        results.push({ node_id: video.node_id, status: 'failed' })
      }
    }

    return NextResponse.json({ archived, failed, skipped, total: (videos || []).length, results })
  }

  if (target === 'client') {
    const clientId = req.nextUrl.searchParams.get('client_id')
    let query = sb.from('client_videos').select('*').eq('status', 'completed').is('permanent_url', null)
    if (clientId) query = query.eq('client_id', clientId)
    const { data: videos } = await query.limit(20)

    let archived = 0
    for (const video of videos || []) {
      if (!video.video_url || video.video_url === 'pending') continue
      const path = `${video.client_id}/${video.id}.mp4`
      const permanentUrl = await archiveVideo(video.video_url, 'client-videos', path)
      if (permanentUrl) {
        await sb.from('client_videos').update({ permanent_url: permanentUrl }).eq('id', video.id)
        archived++
      }
    }
    return NextResponse.json({ archived })
  }

  return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('id')
  if (!videoId) return NextResponse.json({ error: 'No video ID' }, { status: 400 })

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

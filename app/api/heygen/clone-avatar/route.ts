import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const videoFile = form.get('video') as File
  const name = form.get('name') as string

  if (!videoFile) return NextResponse.json({ error: 'No video provided' }, { status: 400 })

  // Upload to HeyGen Instant Avatar API
  const uploadForm = new FormData()
  uploadForm.append('video', videoFile)
  uploadForm.append('name', name || 'My Avatar')

  const res = await fetch('https://api.heygen.com/v2/photo_avatar/photo/upload', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! },
    body: uploadForm
  })

  const data = await res.json()
  
  if (data.data?.photo_avatar_id) {
    // Start training the instant avatar
    const trainRes = await fetch('https://api.heygen.com/v2/photo_avatar', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_avatar_id: data.data.photo_avatar_id,
        name: name || 'My Avatar',
      })
    })
    const trainData = await trainRes.json()
    const avatarId = trainData.data?.avatar_id || data.data.photo_avatar_id
    return NextResponse.json({ avatarId, status: 'training' })
  }

  // Fallback: try instant avatar video upload
  const instForm = new FormData()
  instForm.append('video', videoFile)

  const instRes = await fetch('https://api.heygen.com/v1/instant_avatar.create', {
    method: 'POST', 
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! },
    body: instForm
  })
  const instData = await instRes.json()
  
  if (instData.data?.avatar_id) {
    return NextResponse.json({ avatarId: instData.data.avatar_id, status: 'processing' })
  }

  return NextResponse.json({ error: data.error || instData.error || 'Upload failed', raw: data }, { status: 400 })
}

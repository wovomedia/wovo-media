import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const audioFile = form.get('audio') as File
  const name = form.get('name') as string

  if (!audioFile) return NextResponse.json({ error: 'No audio provided' }, { status: 400 })

  const uploadForm = new FormData()
  uploadForm.append('audio', audioFile)
  uploadForm.append('name', name || 'My Voice')

  const res = await fetch('https://api.heygen.com/v1/voice/clone', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! },
    body: uploadForm
  })
  const data = await res.json()

  if (data.data?.voice_id) {
    return NextResponse.json({ voiceId: data.data.voice_id })
  }

  return NextResponse.json({ error: data.error || 'Voice clone failed', raw: data }, { status: 400 })
}

import { NextResponse } from 'next/server'

export async function GET() {
  const [avatarRes, voiceRes] = await Promise.all([
    fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    }),
    fetch('https://api.heygen.com/v2/voices', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
  ])
  const avatars = await avatarRes.json()
  const voices = await voiceRes.json()

  // Show all avatars with their default voice
  const avatarList = avatars?.data?.avatars?.map((a: any) => ({
    id: a.avatar_id,
    name: a.avatar_name,
    default_voice: a.default_voice_id,
    gender: a.gender,
    preview: a.preview_image_url
  }))

  // Show male English voices
  const maleVoices = voices?.data?.voices
    ?.filter((v: any) => v.gender?.toLowerCase() === 'male')
    ?.map((v: any) => ({
      id: v.voice_id,
      name: v.display_name,
      language: v.language,
      gender: v.gender,
      preview: v.preview_audio
    }))

  return NextResponse.json({ avatarList, maleVoices }, { status: 200 })
}

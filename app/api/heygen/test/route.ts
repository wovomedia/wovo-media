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
  
  // Return first 5 avatars and first 5 English male voices
  return NextResponse.json({
    avatars: avatars?.data?.avatars?.slice(0, 10).map((a: any) => ({
      id: a.avatar_id,
      name: a.avatar_name,
      default_voice: a.default_voice_id
    })),
    voices: voices?.data?.voices?.filter((v: any) => v.language === 'English' && v.gender === 'male').slice(0, 10).map((v: any) => ({
      id: v.voice_id,
      name: v.display_name,
      language: v.language
    }))
  })
}

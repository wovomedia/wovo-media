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

  const tyler = avatars?.data?.avatars?.find((a: any) =>
    a.avatar_id?.includes('Tyler') || a.avatar_name?.toLowerCase().includes('tyler')
  )

  const maleVoices = voices?.data?.voices
    ?.filter((v: any) => v.gender?.toLowerCase() === 'male')
    ?.map((v: any) => ({ id: v.voice_id, name: v.display_name, language: v.language }))

  return NextResponse.json({ tyler, maleVoices })
}

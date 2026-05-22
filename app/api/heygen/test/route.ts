import { NextResponse } from 'next/server'

export async function GET() {
  const [avatarRes, voiceRes, bgRes] = await Promise.all([
    fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    }),
    fetch('https://api.heygen.com/v2/voices', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    }),
    fetch('https://api.heygen.com/v1/background.list', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
  ])

  const avatars = await avatarRes.json()
  const voices = await voiceRes.json()
  const bgs = await bgRes.json()

  // Find Tyler
  const tyler = avatars?.data?.avatars?.find((a: any) => 
    a.avatar_id === 'Tyler-insuit-20220721' || a.avatar_name?.toLowerCase().includes('tyler')
  )

  // Find Pro Confident Male voice
  const proMale = voices?.data?.voices?.filter((v: any) => 
    v.display_name?.toLowerCase().includes('confident') || 
    v.display_name?.toLowerCase().includes('pro') ||
    (v.gender?.toLowerCase() === 'male' && v.language === 'English')
  )?.slice(0, 10)

  return NextResponse.json({
    tyler,
    proMaleVoices: proMale,
    backgrounds: bgs?.data?.backgrounds?.slice(0, 10)
  })
}

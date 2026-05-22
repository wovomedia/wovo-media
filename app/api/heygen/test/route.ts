import { NextResponse } from 'next/server'
export async function GET() {
  try {
    const voiceRes = await fetch('https://api.heygen.com/v2/voices', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const data = await voiceRes.json()
    const maleEn = data?.data?.voices
      ?.filter((v: any) => v.gender === 'male' && v.language?.includes('English'))
      ?.slice(0, 20)
      ?.map((v: any) => ({ id: v.voice_id, name: v.display_name, language: v.language, preview: v.preview_audio }))
    return NextResponse.json({ maleEnglishVoices: maleEn, total: data?.data?.voices?.length })
  } catch(e: any) { return NextResponse.json({ error: e.message }) }
}

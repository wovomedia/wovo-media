import { NextResponse } from 'next/server'
export async function GET() {
  try {
    const res = await fetch('https://api.heygen.com/v2/voices', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const data = await res.json()
    const voices = data?.data?.voices || []
    
    // Find Pro Confident and other male voices
    const proMale = voices.filter((v: any) => 
      v.display_name?.toLowerCase().includes('confident') ||
      v.display_name?.toLowerCase().includes('pro male') ||
      v.display_name?.toLowerCase().includes('professional')
    )
    const allMaleEn = voices.filter((v: any) => 
      v.gender === 'male' && v.language?.includes('English')
    ).slice(0, 30).map((v: any) => ({
      id: v.voice_id, name: v.display_name, language: v.language
    }))
    
    return NextResponse.json({ proMale, allMaleEn, total: voices.length })
  } catch(e: any) { return NextResponse.json({ error: e.message }) }
}

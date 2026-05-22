import { NextResponse } from 'next/server'

export async function GET() {
  // Fetch avatars list to find Tyler's default voice
  const res = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' }
  })
  const data = await res.json()
  
  // Also fetch voices
  const voicesRes = await fetch('https://api.heygen.com/v2/voices', {
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
  })
  const voicesData = await voicesRes.json()
  
  return NextResponse.json({ avatars: data, voices: voicesData })
}

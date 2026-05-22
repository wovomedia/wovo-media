import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const data = await res.json()
    const tyler = data?.data?.avatars?.find((a: any) =>
      a.avatar_id?.includes('Tyler') || a.avatar_name?.toLowerCase().includes('tyler')
    )
    // Return full Tyler object so we can see all available fields
    return NextResponse.json({ 
      tyler,
      apiKeySet: !!process.env.HEYGEN_API_KEY,
      totalAvatars: data?.data?.avatars?.length,
      firstAvatar: data?.data?.avatars?.[0]
    })
  } catch(e: any) {
    return NextResponse.json({ error: e.message, apiKeySet: !!process.env.HEYGEN_API_KEY })
  }
}

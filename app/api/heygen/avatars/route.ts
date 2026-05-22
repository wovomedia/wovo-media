import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' }
  })
  const data = await res.json()
  return NextResponse.json(data)
}

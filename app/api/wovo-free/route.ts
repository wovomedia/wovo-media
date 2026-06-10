import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Free tier limits
const LIMITS = {
  anonymous: { chat: 10, image: 3 },     // not logged in: 10 chats, 3 images/day
  free: { chat: 50, image: 10 },          // logged in free: 50 chats, 10 images/day
  starter: { chat: 999, image: 50 },
  growth: { chat: 999, image: 150 },
  pro_ai: { chat: 999, image: 999 },
}

// Paid-only features
const PAID_FEATURES = ['video', 'series', 'website', 'cinematic_ad', 'wovo_os', 'avatar_clone']
const IMAGE_ACTIONS = ['image', 'edit_image']

async function checkLimit(userId: string | null, action: string, sessionId: string) {
  if (PAID_FEATURES.includes(action)) {
    return { allowed: false, reason: 'paid', message: 'This feature requires a Wovo AI subscription.' }
  }

  if (!userId) {
    // Anonymous user - check session usage
    const { data } = await sb.from('anonymous_usage').select('*').eq('session_id', sessionId).maybeSingle()
    const now = new Date()
    const resetTime = data?.reset_at ? new Date(data.reset_at) : null
    const needsReset = !resetTime || (now.getTime() - resetTime.getTime()) > 86400000

    const count = needsReset ? 0 : (action === 'chat' ? (data?.chat_count || 0) : (data?.image_count || 0))
    const limit = LIMITS.anonymous[action as keyof typeof LIMITS.anonymous] || 0

    if (count >= limit) {
      return { allowed: false, reason: 'limit', message: `You've used your ${limit} free ${action}s today. Sign up for more.` }
    }

    // Increment
    const update = action === 'chat' ? { chat_count: count + 1 } : { image_count: count + 1 }
    if (needsReset) {
      await sb.from('anonymous_usage').upsert({ session_id: sessionId, chat_count: 0, image_count: 0, reset_at: now.toISOString(), ...update })
    } else {
      await sb.from('anonymous_usage').upsert({ session_id: sessionId, ...update })
    }
    return { allowed: true, remaining: limit - count - 1 }
  }

  // Logged in user - check plan
  const { data: profile } = await sb.from('profiles').select('wovo_role').eq('user_id', userId).maybeSingle()
  const { data: client } = await sb.from('clients').select('plan, is_active').eq('profile_id', userId).maybeSingle()

  const role = profile?.wovo_role || 'client'
  if (['owner', 'admin'].includes(role)) return { allowed: true, remaining: 999 }

  const plan = (client?.is_active ? client?.plan : 'free') || 'free'
  const limits = LIMITS[plan as keyof typeof LIMITS] || LIMITS.free

  // Count today's usage
  const today = new Date(); today.setHours(0,0,0,0)
  const { count } = await sb.from('free_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', action)
    .gte('created_at', today.toISOString())

  const limit = limits[action as keyof typeof limits] || 0
  if ((count || 0) >= limit) {
    return { allowed: false, reason: 'limit', message: `You've reached your daily limit. Upgrade for more.`, plan }
  }

  await sb.from('free_usage').insert({ user_id: userId, action_type: action })
  return { allowed: true, remaining: limit - (count || 0) - 1, plan }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, prompt, userId, sessionId } = body

  const check = await checkLimit(userId || null, action, sessionId || 'anon')
  if (!check.allowed) {
    return NextResponse.json({ error: check.message, reason: check.reason, requiresAuth: !userId, requiresPlan: check.reason === 'paid' || check.reason === 'limit' }, { status: 403 })
  }

  // Handle chat
  if (action === 'chat') {
    const chatRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        system: `You are Wovo AI, a smart helpful assistant made by Wovo Media. You can answer any question on any topic — general knowledge, advice, writing, math, coding, life questions, anything. You're especially knowledgeable about social media, digital marketing, content creation, and growing a business online. Be conversational, direct, and genuinely helpful. Keep responses concise unless detail is needed. Never mention Claude, Anthropic, or any third-party AI. If someone asks about making videos, websites, cinematic ads, or AI employees for their business, mention those are available as paid features at wovomedia.com but don't push it unless relevant.`,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await chatRes.json()
    const reply = data.content?.[0]?.text || 'Something went wrong. Try again.'
    return NextResponse.json({ reply, remaining: check.remaining })
  }

  // Handle image generation
  if (action === 'image') {
    const imgRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: { 'Authorization': `Key ${process.env.FAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_size: 'square_hd', num_inference_steps: 4, num_images: 1 })
    })
    const data = await imgRes.json()
    const imageUrl = data.images?.[0]?.url
    if (!imageUrl) return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
    return NextResponse.json({ imageUrl, remaining: check.remaining })
  }

  // Handle image editing (user uploads image + gives instruction)
  if (action === 'edit_image') {
    const imageBase64 = body.imageBase64
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    // Use fal.ai flux with image-to-image editing
    const imgRes = await fetch('https://fal.run/fal-ai/flux/dev/image-to-image', {
      method: 'POST',
      headers: { 'Authorization': `Key ${process.env.FAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_url: imageBase64,
        strength: 0.75,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1
      })
    })
    const data = await imgRes.json()
    const imageUrl = data.images?.[0]?.url
    if (!imageUrl) return NextResponse.json({ error: 'Image editing failed' }, { status: 500 })
    return NextResponse.json({ imageUrl, remaining: check.remaining })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

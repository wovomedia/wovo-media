import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Free tier limits
const LIMITS = {
  anonymous: { chat: 3, image: 0 },      // not logged in: 3 chats, no images
  free: { chat: 10, image: 2 },           // logged in free: 10 chats, 2 images/day
  starter: { chat: 999, image: 10 },
  growth: { chat: 999, image: 25 },
  pro_ai: { chat: 999, image: 999 },
}

// Paid-only features
const PAID_FEATURES = ['video', 'series', 'website', 'cinematic_ad', 'wovo_os', 'avatar_clone']

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
  const { action, prompt, userId, sessionId } = await req.json()

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
        system: `You are Wovo AI, an expert digital marketing AI assistant for Wovo Media. Help businesses grow with AI content, social media strategy, and digital presence. Be concise, helpful, and always tie answers back to how Wovo Media's tools can help. Never mention Claude, Anthropic, or any third-party AI tools. If someone asks about premium features like video generation, cinematic ads, website building, or WOVO OS, explain they need a paid plan and guide them to wovomedia.com.`,
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

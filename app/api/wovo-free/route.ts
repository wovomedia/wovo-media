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
  const { action, prompt, userId, sessionId, history } = body

  const limitAction = (action === 'edit_image') ? 'image' : action
  const check = await checkLimit(userId || null, limitAction, sessionId || 'anon')
  if (!check.allowed) {
    return NextResponse.json({ error: check.message, reason: check.reason, requiresAuth: !userId, requiresPlan: check.reason === 'paid' || check.reason === 'limit' }, { status: 403 })
  }

  // Handle chat
  if (action === 'chat') {
    // Build conversation history for context
    const historyMsgs = (history || []).slice(-10).map((m: any) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content || ''
    })).filter((m: any) => m.content)
    // Add current message
    // If user uploaded an image, include it in the message so Claude can see it
    let userContent: any = prompt
    if (body.imageBase64) {
      const base64Data = body.imageBase64.replace(/^data:image\/[^;]+;base64,/, '')
      const mediaType = body.imageBase64.match(/data:(image\/[^;]+)/)?.[1] || 'image/jpeg'
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: prompt }
      ]
    }
    const messages = [...historyMsgs, { role: 'user', content: userContent }]

    const chatRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        system: `You are Wovo AI, a smart helpful assistant made by Wovo Media. You can answer any question on any topic. You're especially good at social media, digital marketing, and business growth.

CRITICAL: You have FULL image generation and editing capabilities through Wovo's AI systems. NEVER say you can't edit images, manipulate photos, or transform images. You absolutely can and should.

When a user uploads a photo and asks you to transform it (make them a pirate, superhero, put them in a scene, etc.):
1. Look at the photo carefully and describe the person's key features (hair, face shape, etc.)
2. Immediately say you're generating it now
3. End your message with exactly this JSON on its own line: {"generate_image": true, "prompt": "YOUR_DETAILED_PROMPT_HERE"}
   - The prompt should incorporate the person's actual features from the photo + the requested transformation
   - Make it vivid and detailed for best results

Example: User uploads selfie and says "make me a pirate"
Your response: "On it! Generating your pirate transformation now... {"generate_image": true, "prompt": "Portrait of a young male with curly dark brown hair as a swashbuckling pirate captain, wearing a weathered tricorn hat, white billowing shirt, gold earring, aboard a wooden ship with ocean in background, cinematic lighting, photorealistic"}"

When asked to generate any image (no photo uploaded), just respond normally and end with: {"generate_image": true, "prompt": "DETAILED_PROMPT"}

Never say you can't do something visual. Just do it. Be conversational and fun. Never mention Claude, Anthropic, or any third-party AI.`,
        messages
      })
    })
    const data = await chatRes.json()
    let reply = data.content?.[0]?.text || 'Something went wrong. Try again.'

    // Check if AI wants to generate an image
    const imgMatch = reply.match(/\{"generate_image":\s*true,\s*"prompt":\s*"([^"]+)"\}/)
    if (imgMatch) {
      const imgPrompt = imgMatch[1]
      // Remove the JSON from the reply text
      reply = reply.replace(/\{"generate_image".*?\}/, '').trim()

      // Check image limit
      const imgCheck = await checkLimit(userId || null, 'image', sessionId || 'anon')
      if (imgCheck.allowed) {
        const FAL_KEY = process.env.FAL_API_KEY
        if (FAL_KEY) {
          // Step 1: Generate the scene with Flux Dev for quality
          const imgRes = await fetch('https://fal.run/fal-ai/flux/dev', {
            method: 'POST',
            headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: imgPrompt, image_size: 'portrait_4_3', num_inference_steps: 20, guidance_scale: 3.5, num_images: 1 })
          })
          const imgData = await imgRes.json()
          let imageUrl = imgData.images?.[0]?.url

          // Step 2: If user uploaded a photo, face-swap their face onto the generated image
          if (imageUrl && body.imageBase64) {
            try {
              const faceRes = await fetch('https://fal.run/fal-ai/face-swap', {
                method: 'POST',
                headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  source_image_url: body.imageBase64,
                  target_image_url: imageUrl,
                })
              })
              const faceData = await faceRes.json()
              if (faceData.image?.url) imageUrl = faceData.image.url
            } catch {}
          }

          if (imageUrl) {
            return NextResponse.json({ reply: reply || 'Here you go!', imageUrl, remaining: check.remaining })
          }
        }
      }
    }

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

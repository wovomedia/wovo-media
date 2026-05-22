import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

// ── SCRIPTS ────────────────────────────────────────────────────────────────
const SCRIPTS: Record<string, (d: any) => string> = {

  // Sent right after someone books a strategy call
  post_booking: (d) => `Hey ${d.name}! I just got your request for a strategy call, and I'm genuinely excited to connect with you about ${d.business}.

I'm the AI assistant here at Wovo Media, and I wanted to personally reach out before your call to give you a quick look at what we do.

We've helped over 11 businesses grow their online presence — generating over 100 million combined views and engagements. And we do it two ways.

First, Wovo AI — our content platform that creates personalized posts for your entire team, starting at just $29 a month. No filming. No editing. Just ready-to-post content every single day.

Second, Wovo Media Premium — where our team comes to you. Real filming, drone footage, photography, website builds, and full account management. Everything handled for you.

On your call, we'll figure out exactly which one fits ${d.business} best — and build a plan around your goals.

Can't wait to talk. See you soon!`,

  // Sent to new free signups who haven't upgraded
  free_to_paid: (d) => `Hey ${d.name}! Welcome to Wovo Media.

You just created your free account, and I wanted to personally show you what's waiting on the other side.

Right now, businesses just like yours are using Wovo AI to post every single day — without spending hours creating content. Your AI character handles it all. Posts, captions, stories — automatically.

Starting at just $29 a month, you get a custom AI character built around you or your whole team, three to five posts a week, and a rolling content plan that keeps your brand visible.

Or if you want the full experience — on-site filming, drone footage, website builds, and a dedicated team managing everything for you — that's Wovo Media Premium.

${d.business ? `We'd love to help ${d.business} grow.` : "We'd love to help your business grow."} Tap the link below to get started, or book a free strategy call and we'll build a plan together.

Talk soon!`,

  // Sent to premium clients right after they pay — personalized welcome
  premium_welcome: (d) => `Hey ${d.name}, welcome to Wovo Media Premium!

I'm so excited to officially have ${d.business} as part of our family.

Here's what happens next. Within 24 hours, Payton is going to reach out personally to schedule your onboarding call. On that call, you'll go over your brand, your goals, your audience — and we'll map out exactly what we're going to create together.

From there, our team gets to work. Filming, photography, drone footage if needed, website work, social media — all of it managed for you so you can focus on running your business.

You also get access to Wovo AI as part of your Premium membership, so even on days between shoots, your brand stays active and visible.

This is just the beginning. We can't wait to show you what's possible. Check your inbox for your login details and we'll talk soon!`,

  // Sent to Wovo AI clients who haven't upgraded to Premium
  ai_to_premium: (d) => `Hey ${d.name}! You've been crushing it with Wovo AI, and I wanted to personally check in.

You're already posting consistently, building your brand, and staying visible — that's huge. Most businesses never even get that far.

But here's what I want you to know. There's a next level. And it's called Wovo Media Premium.

Imagine adding real filmed content to your feed. Behind-the-scenes footage. Drone shots. Photography. Skits that actually go viral. All managed by our team — no extra work for you.

We've taken businesses from a few thousand views a month to millions. And we'd love to do the same for ${d.business || 'your business'}.

If you're curious about what Premium could look like for you specifically, just reply to this email or book a quick call. There's no pressure — just a real conversation about what's possible.

Talk soon!`,
}

async function generateHeyGenVideo(script: string, avatarId: string, voiceId: string) {
  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
        voice: { type: 'text', input_text: script, voice_id: voiceId },
        background: { type: 'color', value: '#0a0a0a' }
      }],
      dimension: { width: 1280, height: 720 },
    })
  })
  const data = await res.json()
  return data.data?.video_id
}

async function pollVideoReady(videoId: string, maxAttempts = 60): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 8000))
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! }
    })
    const data = await res.json()
    if (data.data?.status === 'completed') return data.data.video_url
    if (data.data?.status === 'failed') return null
  }
  return null
}

function videoEmailHtml(name: string, headline: string, subtext: string, videoUrl: string, ctaText: string, ctaUrl: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#111;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
  <div style="padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.04em">wovo<span style="color:#00E5C8">media</span></div>
    <div style="font-size:12px;color:#444">Personal message for ${name}</div>
  </div>
  <div style="padding:0">
    <a href="${videoUrl}" target="_blank" style="display:block;position:relative;cursor:pointer">
      <div style="background:linear-gradient(135deg,#0d1117 0%,#161b22 100%);aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;position:relative">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.6) 100%)"></div>
        <div style="width:64px;height:64px;background:#00E5C8;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 0 40px rgba(0,229,200,0.4)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#080808"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
        <div style="position:absolute;bottom:16px;left:16px;right:16px;z-index:1">
          <div style="font-size:11px;color:#00E5C8;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:4px">Personal video message</div>
          <div style="font-size:15px;color:#fff;font-weight:600">${headline}</div>
        </div>
      </div>
    </a>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#999;font-size:14px;line-height:1.7;margin:0 0 24px">${subtext}</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${ctaUrl}" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.01em">${ctaText}</a>
    </div>
    <p style="color:#444;font-size:12px;margin:20px 0 0;text-align:center">Questions? Reply to this email or text (931) 458-3255</p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
    <p style="color:#333;font-size:11px;margin:0">wovomedia.com · Payton@wovomedia.com</p>
  </div>
</div>
</body></html>`
}

export async function POST(req: NextRequest) {
  const { type, name, email, business, clientId } = await req.json()

  // Default to a reliable public HeyGen avatar & voice
  const AVATAR_ID = 'Tyler-insuit-20220721'
  const VOICE_ID  = '1bd001e7e50f421d891986aad5158bc8'

  const scriptFn = SCRIPTS[type]
  if (!scriptFn) return NextResponse.json({ error: 'Unknown video type' }, { status: 400 })

  const script = scriptFn({ name, business })

  // Start generation (async — don't block the response)
  // We respond immediately and process in background
  const emailConfig: Record<string, { headline: string; subtext: string; cta: string; url: string }> = {
    post_booking: {
      headline: 'A personal message before your strategy call',
      subtext: `Hey ${name} — watch this quick video from the Wovo Media team before your strategy call. We put it together just for you.`,
      cta: 'Book your strategy call →',
      url: 'https://calendly.com/wovomedia/wovo-media-strategy-call',
    },
    free_to_paid: {
      headline: `Here's what's waiting for ${business || 'your business'}`,
      subtext: 'You just joined Wovo Media. Watch this quick intro to see what our clients are doing — and how you can do the same.',
      cta: 'Start Wovo AI — $29/mo →',
      url: 'https://wovomedia.com/wovo-ai',
    },
    premium_welcome: {
      headline: `Welcome to Wovo Media Premium, ${name}!`,
      subtext: 'Your account is live. Watch this short welcome video to see exactly what happens next.',
      cta: 'Log in to your dashboard →',
      url: 'https://wovomedia.com/dashboard/client',
    },
    ai_to_premium: {
      headline: "You're ready for the next level",
      subtext: `${name}, you've been consistent with Wovo AI. Watch this to see what adding real production could do for your brand.`,
      cta: 'Book a Premium strategy call →',
      url: 'https://calendly.com/wovomedia/wovo-media-strategy-call',
    },
  }

  const cfg = emailConfig[type]

  // Generate video and send email (background)
  ;(async () => {
    try {
      const videoId = await generateHeyGenVideo(script, AVATAR_ID, VOICE_ID)
      if (!videoId) return

      // Save video ID to DB
      if (clientId) {
        await sb.from('clients').update({ welcome_video_id: videoId }).eq('id', clientId)
      }

      // Poll for video completion (up to ~8 min)
      const videoUrl = await pollVideoReady(videoId)
      if (!videoUrl) return

      // Update DB with URL
      if (clientId) {
        await sb.from('clients').update({ welcome_video_url: videoUrl }).eq('id', clientId)
      }

      // Send email with video
      await resend.emails.send({
        from: 'Wovo Media <Payton@wovomedia.com>',
        to: email,
        subject: cfg.headline,
        html: videoEmailHtml(name, cfg.headline, cfg.subtext, videoUrl, cfg.cta, cfg.url),
      })
    } catch (e) {
      console.error('Video generation error:', e)
    }
  })()

  return NextResponse.json({ success: true, message: 'Video generating — email will be sent when ready (5–10 min)' })
}

export type NovaNode = {
  id: string
  script: string        // What Nova says
  options?: {
    label: string       // Button text shown to user
    next: string        // Which node to go to
  }[]
  outcome?: 'wovo_ai' | 'premium' | 'both'  // Terminal nodes
  cta?: { label: string; url: string }
}

export const NOVA_FLOW: Record<string, NovaNode> = {
  intro: {
    id: 'intro',
    script: `Hey! I'm Nova, and I'm here to help you figure out the best way to grow your business online with Wovo Media. I just have a few quick questions. First one — what kind of business are you running?`,
    options: [
      { label: '🍽️ Restaurant or food & drink', next: 'restaurant' },
      { label: '🛍️ Retail or boutique', next: 'retail' },
      { label: '💼 Service business', next: 'service' },
      { label: '🏥 Healthcare or wellness', next: 'service' },
      { label: '🎯 Something else', next: 'other' },
    ]
  },

  restaurant: {
    id: 'restaurant',
    script: `Restaurants are honestly our best category — daily specials, behind-the-scenes videos, promotions — they perform incredibly well on social. Quick question: do you have a team, or is it mostly just you running things?`,
    options: [
      { label: '👥 I have a team of staff', next: 'has_team' },
      { label: '🙋 Just me for now', next: 'solo' },
    ]
  },

  retail: {
    id: 'retail',
    script: `Boutiques and retail brands do amazing with consistent content — new arrivals, styling tips, behind the scenes. Love it. Are you mostly running things yourself, or do you have staff who could also be part of your content?`,
    options: [
      { label: '👥 I have a team', next: 'has_team' },
      { label: '🙋 Just me', next: 'solo' },
    ]
  },

  service: {
    id: 'service',
    script: `Service businesses can build huge trust through content — showing your expertise, your team, your results. That's exactly what we help with. Do you have staff or is it mainly you?`,
    options: [
      { label: '👥 I have a team', next: 'has_team' },
      { label: '🙋 Solo for now', next: 'solo' },
    ]
  },

  other: {
    id: 'other',
    script: `No worries — we work with all kinds of businesses. Let me ask you something that'll help me point you in the right direction. What's your current situation with social media?`,
    options: [
      { label: '😬 Barely posting at all', next: 'not_posting' },
      { label: '📱 Posting but not growing', next: 'not_growing' },
      { label: '🤔 I want someone to handle it for me', next: 'wants_managed' },
    ]
  },

  has_team: {
    id: 'has_team',
    script: `That's awesome — having a team is actually a huge advantage with Wovo AI. Our Growth plan lets you create AI characters for every single person on your team, not just yourself. So your whole staff is posting consistently. Now, what's your monthly budget looking like for marketing?`,
    options: [
      { label: '💰 Under $100/month', next: 'budget_low_team' },
      { label: '💰 $100 to $500/month', next: 'budget_mid' },
      { label: '💰 $500 or more', next: 'budget_high' },
    ]
  },

  solo: {
    id: 'solo',
    script: `Totally fine — you'd be surprised how much our Starter plan can do for just one person. Your own AI character, three to five posts a week, ready-to-copy captions. You don't have to do anything. What's your monthly budget for marketing?`,
    options: [
      { label: '💰 Under $50/month', next: 'budget_very_low' },
      { label: '💰 $50 to $150/month', next: 'budget_low_solo' },
      { label: '💰 $150 or more', next: 'budget_mid' },
    ]
  },

  not_posting: {
    id: 'not_posting',
    script: `Honestly, that's exactly who Wovo AI is built for. You don't need to know what to post or when — your AI character handles all of it. Posts, captions, everything. What matters most to you right now?`,
    options: [
      { label: '⚡ I just need to start posting consistently', next: 'budget_low_solo' },
      { label: '🚀 I want real results fast, budget isn\'t the issue', next: 'budget_high' },
    ]
  },

  not_growing: {
    id: 'not_growing',
    script: `That's one of the most common things I hear. You're putting in the effort but the algorithm isn't rewarding it. The issue is usually consistency and content quality. We fix both. Are you open to a strategy where we handle everything — filming included?`,
    options: [
      { label: '🎬 Yes, I want real filming and full management', next: 'wants_premium' },
      { label: '🤖 I\'d start with AI content first', next: 'budget_mid' },
    ]
  },

  wants_managed: {
    id: 'wants_managed',
    script: `Then you're describing Wovo Media Premium exactly. We come to you — filming, drone, photography, website, social media — everything managed by our team. You focus on running your business. We handle your entire online presence. Want to learn more?`,
    options: [
      { label: '🔥 Yes, tell me more about Premium', next: 'wants_premium' },
      { label: '💡 What about a more affordable option?', next: 'budget_mid' },
    ]
  },

  wants_premium: {
    id: 'wants_premium',
    script: `Premium is our full-service offering — our team comes on-site to film, capture drone footage, photography, manage your social media accounts, build your website, and handle your Google Business Profile. Payton personally manages every account. It's custom-priced for each business, usually between three hundred and two thousand dollars a month depending on scope. The best next step is a free strategy call where we build a plan around your goals. No commitment.`,
    options: [
      { label: '📅 Book a free strategy call', next: 'close_premium' },
      { label: '🤔 Still considering — what\'s Wovo AI?', next: 'explain_ai' },
    ]
  },

  budget_very_low: {
    id: 'budget_very_low',
    script: `Totally understandable — that's exactly why we built Wovo AI Starter. For twenty-nine dollars a month — literally less than a tank of gas — you get an AI character built around you, three to five posts a week, and ready-to-copy captions. No filming, no editing, no effort on your end. Want to get started?`,
    options: [
      { label: '✅ Yes, let\'s do the Starter plan', next: 'close_ai_starter' },
      { label: '👀 Tell me more first', next: 'explain_ai' },
    ]
  },

  budget_low_solo: {
    id: 'budget_low_solo',
    script: `Perfect — Wovo AI Starter is exactly right for you. Twenty-nine dollars a month, your own AI character, consistent posts every week. You'll never have to stress about what to post again. Want to jump in?`,
    options: [
      { label: '🚀 Start Wovo AI Starter — $29/mo', next: 'close_ai_starter' },
      { label: '📅 I want to talk to someone first', next: 'close_call' },
    ]
  },

  budget_low_team: {
    id: 'budget_low_team',
    script: `For a business with a team, I'd actually recommend Wovo AI Growth — it's forty-nine dollars a month and it gives every single team member their own AI character. Five posts a week, unlimited edits. For the price of a dinner out, your whole team is posting every week.`,
    options: [
      { label: '🚀 Start Wovo AI Growth — $49/mo', next: 'close_ai_growth' },
      { label: '📅 Book a call to learn more', next: 'close_call' },
    ]
  },

  budget_mid: {
    id: 'budget_mid',
    script: `With that budget you've got two solid options. Wovo AI Growth at forty-nine a month gets your whole team posting with AI characters. Or if you want real filming added on top, we can look at a Premium plan that fits your budget. Which direction feels right?`,
    options: [
      { label: '🤖 Wovo AI Growth — $49/mo', next: 'close_ai_growth' },
      { label: '🎬 I want real filming — let\'s talk Premium', next: 'close_premium' },
    ]
  },

  budget_high: {
    id: 'budget_high',
    script: `With that kind of budget, you should seriously consider Wovo Media Premium. Real filming, drone footage, photography, website, full account management — everything done for you. Businesses we manage are hitting millions of views a month. I'd love to get you on a quick strategy call so we can map out exactly what that looks like for your business.`,
    options: [
      { label: '📅 Book a free strategy call', next: 'close_premium' },
      { label: '🤖 Start with Wovo AI first', next: 'close_ai_growth' },
    ]
  },

  explain_ai: {
    id: 'explain_ai',
    script: `Wovo AI creates an AI character based on you or your team. It generates ready-to-post content every week — captions, post ideas, everything tailored to your business. You review it, approve it, and post. No filming, no editing, no stress. Starter is twenty-nine a month for just you. Growth is forty-nine and includes AI characters for your whole team. Which one sounds right?`,
    options: [
      { label: '🙋 Just me — Starter at $29', next: 'close_ai_starter' },
      { label: '👥 My team too — Growth at $49', next: 'close_ai_growth' },
      { label: '🎬 I want the full Premium experience', next: 'close_premium' },
    ]
  },

  close_ai_starter: {
    id: 'close_ai_starter',
    script: `Amazing — you're going to love it. Get started right now and your AI character will be up and running in no time. Welcome to Wovo Media!`,
    outcome: 'wovo_ai',
    cta: { label: 'Start Wovo AI Starter — $29/mo →', url: '/wovo-ai?plan=starter' }
  },

  close_ai_growth: {
    id: 'close_ai_growth',
    script: `Great choice — your team is going to be so glad you did this. Let's get everyone set up with their own AI character. Welcome to Wovo Media!`,
    outcome: 'wovo_ai',
    cta: { label: 'Start Wovo AI Growth — $49/mo →', url: '/wovo-ai?plan=growth' }
  },

  close_premium: {
    id: 'close_premium',
    script: `I'm genuinely excited for you — Premium clients are the ones we see blow up the fastest. Book a free strategy call and Payton will personally reach out to build your plan. No commitment, no pressure — just a real conversation about what's possible for your business.`,
    outcome: 'premium',
    cta: { label: 'Book a Free Strategy Call →', url: 'https://calendly.com/wovomedia/wovo-media-strategy-call' }
  },

  close_call: {
    id: 'close_call',
    script: `Totally — let's get on a quick call and figure out exactly what makes sense for your business. Payton will walk you through everything and build a custom plan. It's free, no commitment, and usually takes about twenty minutes.`,
    outcome: 'both',
    cta: { label: 'Book a Free Strategy Call →', url: 'https://calendly.com/wovomedia/wovo-media-strategy-call' }
  },
}

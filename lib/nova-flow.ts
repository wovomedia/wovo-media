export type NovaNode = {
  id: string
  script: string
  options?: { label: string; next: string }[]
  outcome?: 'wovo_ai' | 'premium' | 'both'
  cta?: { label: string; url: string }
}

// FAST flow — max 3 questions, under 90 seconds total
export const NOVA_FLOW: Record<string, NovaNode> = {

  intro: {
    id: 'intro',
    script: `Hey! I'm Nova. Two quick questions and I'll tell you exactly which Wovo plan fits your business. What type of business do you run?`,
    options: [
      { label: '🍽️ Restaurant / Food', next: 'food' },
      { label: '🛍️ Retail / Boutique', next: 'product' },
      { label: '💼 Service Business', next: 'service' },
      { label: '📱 Content Creator', next: 'creator' },
    ]
  },

  food: {
    id: 'food',
    script: `Restaurants are our strongest category — daily specials, behind-the-scenes, promotions. We have clients hitting four million views a month. What's your monthly budget for content?`,
    options: [
      { label: '💰 Under $100/mo', next: 'budget_low' },
      { label: '💰 $100–$300/mo', next: 'budget_mid' },
      { label: '💰 $300+/mo', next: 'budget_high' },
    ]
  },

  product: {
    id: 'product',
    script: `Boutiques and retail brands crush it with new arrivals, styling videos, and product showcases. What are you spending on content right now?`,
    options: [
      { label: '💰 Under $100/mo', next: 'budget_low' },
      { label: '💰 $100–$300/mo', next: 'budget_mid' },
      { label: '💰 $300+/mo', next: 'budget_high' },
    ]
  },

  service: {
    id: 'service',
    script: `Service businesses build massive trust through content — showing your work, your team, your results. What's your content budget right now?`,
    options: [
      { label: '💰 Under $100/mo', next: 'budget_low' },
      { label: '💰 $100–$300/mo', next: 'budget_mid' },
      { label: '💰 $300+/mo', next: 'budget_high' },
    ]
  },

  creator: {
    id: 'creator',
    script: `Love it. AI characters, consistent posting, multiple platforms — Wovo AI was basically built for creators. What's your monthly budget?`,
    options: [
      { label: '💰 Under $100/mo', next: 'budget_low' },
      { label: '💰 $100–$300/mo', next: 'budget_mid' },
      { label: '💰 $300+/mo', next: 'budget_high' },
    ]
  },

  budget_low: {
    id: 'budget_low',
    script: `Perfect — Wovo AI Starter at twenty-nine dollars a month gets you an AI character, three posts per week, ready-to-copy captions, and full posting tutorials. Most clients see real growth within the first thirty days.`,
    options: [
      { label: '🚀 Start for $29/mo', next: 'close_starter' },
      { label: '📞 Talk to someone first', next: 'close_call' },
    ]
  },

  budget_mid: {
    id: 'budget_mid',
    script: `Growth plan at forty-nine dollars a month is perfect. You get AI characters for your whole team, five posts a week, the AI video generator, and unlimited edits. It's our most popular plan by far.`,
    options: [
      { label: '🚀 Get Growth — $49/mo', next: 'close_growth' },
      { label: '📞 Talk to someone first', next: 'close_call' },
    ]
  },

  budget_high: {
    id: 'budget_high',
    script: `At that budget you've got two great options — Wovo AI Pro at seventy-nine a month for full AI content, or Wovo Media Premium where our real team films, edits, and posts for you. Which sounds better?`,
    options: [
      { label: '🤖 AI Pro — $79/mo', next: 'close_pro' },
      { label: '🎬 Full-Service Premium', next: 'close_premium' },
    ]
  },

  close_starter: {
    id: 'close_starter',
    script: `Let's get you started. Click below to subscribe — your account is created automatically and you'll be posting within the hour.`,
    outcome: 'wovo_ai',
    cta: { label: 'Start Wovo AI — $29/mo →', url: 'https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y' }
  },

  close_growth: {
    id: 'close_growth',
    script: `Awesome choice. Growth is our most popular plan — click below and you're set up instantly. I'll see you on the other side.`,
    outcome: 'wovo_ai',
    cta: { label: 'Get Growth — $49/mo →', url: 'https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z' }
  },

  close_pro: {
    id: 'close_pro',
    script: `Pro AI is the full package — daily posts, Stories, multiple brands, image ad generator. Click below and let's get you growing.`,
    outcome: 'wovo_ai',
    cta: { label: 'Get Pro AI — $79/mo →', url: 'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10' }
  },

  close_premium: {
    id: 'close_premium',
    script: `Premium is where we really shine. Real filming, drone, photography, website builds — our team handles everything. Book a free call and we'll put together a custom plan for you.`,
    outcome: 'premium',
    cta: { label: 'Book a Free Strategy Call →', url: 'https://calendly.com/wovomedia/wovo-media-premium-strategy-call' }
  },

  close_call: {
    id: 'close_call',
    script: `No problem at all. Book a free fifteen-minute call and we'll walk you through exactly what works for your business. Zero pressure.`,
    outcome: 'both',
    cta: { label: 'Book a Free Call →', url: 'https://calendly.com/wovomedia/wovo-media-premium-strategy-call' }
  },
}

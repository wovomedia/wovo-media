"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readSessionFromStorage } from "@/lib/supabase/session-client";
import { getAuthAccessState } from "@/lib/wovo-ai/access";

type Business = {
  id: string;
  name: string;
  type: string;
  location: string;
  avatar: string;
  bio: string;
  members: number;
  posts: number;
  collab: boolean;
  tags: string[];
  online: boolean;
};

type NetworkPost = {
  id: string;
  businessName: string;
  businessType: string;
  avatar: string;
  platform: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
  time: string;
  collab?: boolean;
  collabWith?: string;
};

type Message = {
  id: string;
  from: string;
  fromAvatar: string;
  preview: string;
  time: string;
  unread: boolean;
};

const DEMO_BUSINESSES: Business[] = [
  { id: "1", name: "Campbell Station Restaurant", type: "Restaurant", location: "Culleoka, TN", avatar: "🍽️", bio: "Family restaurant with Southern comfort food. Always looking to collab on food-related content!", members: 1, posts: 47, collab: true, tags: ["restaurant","southern food","family dining"], online: true },
  { id: "2", name: "Boot Stompin' BBQ", type: "Restaurant", location: "Columbia, TN", avatar: "🍖", bio: "The best BBQ in Maury County. Open for catering and love cross-promotion with local businesses.", members: 1, posts: 31, collab: true, tags: ["BBQ","catering","Columbia TN"], online: true },
  { id: "3", name: "Thiesing Family Chiropractic", type: "Healthcare", location: "Tennessee", avatar: "🏥", bio: "Helping families feel their best through chiropractic care. Happy to collab on wellness content.", members: 2, posts: 18, collab: true, tags: ["health","wellness","chiropractic"], online: false },
  { id: "4", name: "Liquid Fire Vintage Neon", type: "Specialty Retail", location: "Tennessee", avatar: "💡", bio: "Vintage neon signs and custom lighting. Unique pieces for restaurants, homes, and businesses.", members: 1, posts: 22, collab: true, tags: ["neon","vintage","decor","retail"], online: true },
  { id: "5", name: "The Ranch at Renshaw Farms", type: "Farm & Venue", location: "Tennessee", avatar: "🌾", bio: "A beautiful Tennessee farm available for events, weddings, and agritourism experiences.", members: 2, posts: 15, collab: false, tags: ["farm","venue","events","Tennessee"], online: false },
  { id: "6", name: "Mayor Sheila Butt", type: "Government", location: "Maury County, TN", avatar: "🏛️", bio: "Serving the people of Maury County. Open to community collaboration and local business spotlights.", members: 1, posts: 29, collab: false, tags: ["government","community","Maury County"], online: true },
];

const DEMO_POSTS: NetworkPost[] = [
  { id: "p1", businessName: "Boot Stompin' BBQ", businessType: "Restaurant", avatar: "🍖", platform: "Instagram", content: "🔥 Weekend special is BACK — slow-smoked brisket plate for just $12.99! Only Friday through Sunday while supplies last.\n\nCome hungry, leave happy. 🤤 Tag a friend who needs this in their life.\n\n#BBQ #Brisket #ColumbiaTN #WeekendSpecial", likes: 84, comments: 23, shares: 15, time: "2h ago", collab: false },
  { id: "p2", businessName: "Campbell Station × Liquid Fire Neon", businessType: "Restaurant", avatar: "🍽️", platform: "Facebook", content: "✨ BIG ANNOUNCEMENT — we've partnered with @LiquidFireVintageNeon to install a stunning custom neon sign in our dining room!\n\nCome in this weekend to see it lit up and grab a meal. 🌟 Two local Tennessee businesses, one unforgettable space.\n\n#LocalTN #CollabAlert #VintageNeon #CampbellStation", likes: 142, comments: 37, shares: 28, time: "5h ago", collab: true, collabWith: "Liquid Fire Vintage Neon" },
  { id: "p3", businessName: "Thiesing Family Chiropractic", businessType: "Healthcare", avatar: "🏥", platform: "Instagram", content: "📣 Did you know? Most neck and back pain can be prevented with consistent chiropractic care.\n\nThis month we're running a NEW PATIENT special — your first visit is just $49 (normally $120).\n\nBook online or call us today. Your back will thank you! 💚\n\n#Chiropractic #WellnessTN #BackPain #HealthTips", likes: 61, comments: 14, shares: 9, time: "1d ago", collab: false },
  { id: "p4", businessName: "The Ranch at Renshaw Farms", businessType: "Farm & Venue", avatar: "🌾", platform: "Facebook", content: "🌅 Golden hour at the Ranch hits different in summer...\n\nWe still have a few 2025 wedding dates available! Perfect for outdoor ceremonies with Tennessee rolling hills as your backdrop.\n\nDM us or email to schedule a tour. 💍\n\n#TennesseeWedding #FarmVenue #RenshawFarms #OutdoorWedding", likes: 203, comments: 56, shares: 41, time: "2d ago", collab: false },
];

const DEMO_MESSAGES: Message[] = [
  { id: "m1", from: "Boot Stompin' BBQ", fromAvatar: "🍖", preview: "Hey! Would you want to collab on a cross-promo post? We could...", time: "1h ago", unread: true },
  { id: "m2", from: "Liquid Fire Vintage Neon", fromAvatar: "💡", preview: "Thanks for the shoutout! Let's definitely do a joint post next week.", time: "3h ago", unread: true },
  { id: "m3", from: "Thiesing Family Chiropractic", fromAvatar: "🏥", preview: "Interested in a wellness + restaurant collab content series?", time: "1d ago", unread: false },
];

const COLLAB_IDEAS = [
  { title: "Food × Wellness", emoji: "🥗", desc: "Restaurant + chiro collab on 'healthy eating' content series", businesses: ["Restaurant", "Healthcare"] },
  { title: "Local Spotlight", emoji: "📍", desc: "Two Maury County businesses spotlight each other's story", businesses: ["Any", "Any"] },
  { title: "Event × Catering", emoji: "🎉", desc: "Farm venue + BBQ catering joint promotion for events", businesses: ["Farm & Venue", "Restaurant"] },
  { title: "Decor × Dining", emoji: "✨", desc: "Neon shop + restaurant — custom sign reveal content", businesses: ["Specialty Retail", "Restaurant"] },
];

export default function NetworkPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"feed" | "businesses" | "messages" | "collab">("feed");
  const [searchBiz, setSearchBiz] = useState("");
  const [activeConvo, setActiveConvo] = useState<Message | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [filter, setFilter] = useState("All");
  const [collabModal, setCollabModal] = useState<Business | null>(null);
  const [aiPostIdea, setAiPostIdea] = useState("");
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatedPost, setGeneratedPost] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = readSessionFromStorage();
    const auth = getAuthAccessState({ session });
    if (!auth.isAuthenticated) router.push("/login");
  }, [router]);

  const filteredBiz = DEMO_BUSINESSES.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(searchBiz.toLowerCase()) || b.type.toLowerCase().includes(searchBiz.toLowerCase()) || b.tags.some(t => t.includes(searchBiz.toLowerCase()));
    const matchFilter = filter === "All" || b.type === filter;
    return matchSearch && matchFilter;
  });

  const sendMessage = () => {
    if (!messageText.trim() || !activeConvo) return;
    setMessageText("");
  };

  const generateCollabPost = async () => {
    if (!collabModal || !aiPostIdea.trim()) return;
    setGeneratingPost(true);
    await new Promise(r => setTimeout(r, 1800));
    setGeneratedPost(`🤝 COLLAB ALERT — @YourBusiness + @${collabModal.name}\n\nWe've teamed up to bring you something special! ${aiPostIdea}\n\nTwo local businesses, one awesome deal. Follow both pages and tag a friend who needs to see this!\n\n💬 Comment below with your questions.\n\n#LocalTN #ColabAlert #SupportLocal #SmallBusiness #WovoAI`);
    setGeneratingPost(false);
  };

  const industryTypes = ["All", "Restaurant", "Healthcare", "Farm & Venue", "Specialty Retail", "Government", "Contracting", "Home Services"];

  return (
    <main className="min-h-screen bg-[#060807] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#060807]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/wovo-ai" className="text-zinc-500 hover:text-white transition text-sm">← Wovo AI</Link>
          <span className="text-zinc-700">/</span>
          <h1 className="text-lg font-black text-white">🤝 Business Network</h1>
          <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Beta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {DEMO_BUSINESSES.filter(b => b.online).length} online
            </div>
          </div>
          {messages.filter(m => m.unread).length > 0 && (
            <button onClick={() => setActiveTab("messages")} className="flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-300 transition">
              💬 {messages.filter(m => m.unread).length} new messages
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-[#0d0f0e] p-1 w-fit">
          {(["feed", "businesses", "messages", "collab"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${activeTab === tab ? "bg-emerald-400 text-black" : "text-zinc-400 hover:text-white"}`}>
              {tab === "feed" ? "🌐 Feed" : tab === "businesses" ? "🏢 Directory" : tab === "messages" ? `💬 Messages${messages.filter(m => m.unread).length > 0 ? ` (${messages.filter(m => m.unread).length})` : ""}` : "✨ AI Collab"}
            </button>
          ))}
        </div>

        {/* ─── FEED TAB ─── */}
        {activeTab === "feed" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {/* Compose a post */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1110] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-sm font-bold text-emerald-400">Y</div>
                  <div className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-500 cursor-pointer hover:border-emerald-400/30 hover:text-zinc-300 transition" onClick={() => setActiveTab("collab")}>
                    Share something with the network... or create a collab post with AI ✨
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab("collab")} className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition">✨ AI Collab Post</button>
                  <button className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-white/20 transition">📸 Share Image</button>
                  <button className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-white/20 transition">📢 Announcement</button>
                </div>
              </div>

              {/* Posts */}
              {DEMO_POSTS.map(post => (
                <div key={post.id} className="rounded-2xl border border-white/10 bg-[#0d1110] overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">{post.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{post.businessName}</span>
                          {post.collab && <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">✨ Collab Post</span>}
                          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">{post.platform}</span>
                        </div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">{post.businessType} · {post.time}</div>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{post.content}</p>
                  </div>
                  <div className="border-t border-white/10 px-4 py-2.5 flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition">❤️ {post.likes}</button>
                    <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition">💬 {post.comments}</button>
                    <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition">🔗 {post.shares}</button>
                    <button className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-zinc-400 hover:border-emerald-400/50 hover:text-emerald-400 transition">Use in Wovo AI</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Who to connect */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1110] p-4">
                <h3 className="text-sm font-bold text-zinc-300 mb-3">🟢 Online Now</h3>
                <div className="space-y-3">
                  {DEMO_BUSINESSES.filter(b => b.online).slice(0, 4).map(b => (
                    <div key={b.id} className="flex items-center gap-3">
                      <div className="relative h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm flex-shrink-0">
                        {b.avatar}
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#0d1110]"></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-zinc-300 truncate">{b.name}</div>
                        <div className="text-[10px] text-zinc-600">{b.type}</div>
                      </div>
                      {b.collab && (
                        <button onClick={() => setCollabModal(b)} className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/30 transition">Collab</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trending collab ideas */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1110] p-4">
                <h3 className="text-sm font-bold text-zinc-300 mb-3">💡 Collab Ideas</h3>
                <div className="space-y-2">
                  {COLLAB_IDEAS.map(idea => (
                    <button key={idea.title} onClick={() => setActiveTab("collab")} className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 hover:border-emerald-400/30 hover:bg-emerald-500/5 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{idea.emoji}</span>
                        <span className="text-xs font-bold text-zinc-300">{idea.title}</span>
                      </div>
                      <p className="text-[10px] text-zinc-600 leading-snug">{idea.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── DIRECTORY TAB ─── */}
        {activeTab === "businesses" && (
          <div>
            <div className="mb-4 flex flex-wrap gap-3">
              <input value={searchBiz} onChange={e => setSearchBiz(e.target.value)} placeholder="Search businesses, industries, tags..." className="flex-1 min-w-64 rounded-xl border border-white/10 bg-[#0d0f0e] px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/50 transition" />
              <div className="flex flex-wrap gap-1.5">
                {industryTypes.slice(0, 5).map(t => (
                  <button key={t} onClick={() => setFilter(t)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === t ? "border-emerald-400/80 bg-emerald-500/15 text-emerald-200" : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBiz.map(biz => (
                <div key={biz.id} className="rounded-2xl border border-white/10 bg-[#0d1110] p-4 hover:border-white/20 transition">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                      {biz.avatar}
                      {biz.online && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0d1110]"></span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-white truncate">{biz.name}</div>
                      <div className="text-xs text-zinc-500">{biz.type} · {biz.location}</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">{biz.bio}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {biz.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">#{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-3">
                    <span>{biz.posts} posts</span>
                    {biz.collab && <span className="text-emerald-400 font-semibold">✨ Open to collabs</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setActiveConvo({ id: biz.id, from: biz.name, fromAvatar: biz.avatar, preview: "", time: "now", unread: false }); setActiveTab("messages"); }} className="flex-1 rounded-lg border border-white/10 py-1.5 text-xs font-semibold text-zinc-300 hover:border-white/20 hover:text-white transition">💬 Message</button>
                    {biz.collab && (
                      <button onClick={() => setCollabModal(biz)} className="flex-1 rounded-lg bg-emerald-400 py-1.5 text-xs font-bold text-black hover:bg-emerald-300 transition">✨ Collab</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── MESSAGES TAB ─── */}
        {activeTab === "messages" && (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Inbox */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1110] overflow-hidden">
              <div className="border-b border-white/10 px-4 py-3">
                <h3 className="font-bold text-sm text-zinc-300">Messages</h3>
              </div>
              <div className="divide-y divide-white/5">
                {messages.map(msg => (
                  <button key={msg.id} onClick={() => setActiveConvo(msg)} className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition ${activeConvo?.id === msg.id ? "bg-emerald-500/10" : ""}`}>
                    <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">{msg.fromAvatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-bold truncate ${msg.unread ? "text-white" : "text-zinc-400"}`}>{msg.from}</span>
                        <span className="text-[10px] text-zinc-600 flex-shrink-0 ml-2">{msg.time}</span>
                      </div>
                      <p className={`text-xs truncate ${msg.unread ? "text-zinc-300" : "text-zinc-600"}`}>{msg.preview}</p>
                    </div>
                    {msg.unread && <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5"></span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1110] flex flex-col overflow-hidden" style={{minHeight: '500px'}}>
              {activeConvo ? (
                <>
                  <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                    <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl">{activeConvo.fromAvatar}</div>
                    <div>
                      <div className="font-bold text-sm text-white">{activeConvo.from}</div>
                      <div className="text-[10px] text-emerald-400">● Online</div>
                    </div>
                    <button onClick={() => { const b = DEMO_BUSINESSES.find(x => x.name === activeConvo.from); if (b) setCollabModal(b); }} className="ml-auto rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition">✨ Create Collab Post</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-sm text-zinc-300">
                        Hey! I saw your business on the Wovo network. Would love to collab on some content together — our customers would probably love each other's businesses! 🤝
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-emerald-500/20 border border-emerald-400/30 px-4 py-2.5 text-sm text-emerald-50">
                        That sounds great! We've been looking for local businesses to partner with. What did you have in mind?
                      </div>
                    </div>
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex-shrink-0 border-t border-white/10 p-3 flex gap-2">
                    <input value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder={`Message ${activeConvo.from}...`} className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/50 transition" />
                    <button onClick={sendMessage} disabled={!messageText.trim()} className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-300 disabled:opacity-40 transition">Send</button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                  <div className="text-5xl mb-4">💬</div>
                  <h3 className="font-bold text-white mb-2">Your Messages</h3>
                  <p className="text-sm text-zinc-500 max-w-xs">Select a conversation from the left, or find a business in the Directory and message them directly.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── AI COLLAB TAB ─── */}
        {activeTab === "collab" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-black text-white mb-1">✨ AI Collab Post Generator</h2>
                <p className="text-sm text-zinc-400">Select a business partner and let Wovo AI write a collaboration post for both of you — ready to post on any platform.</p>
              </div>

              {/* Partner selector */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1110] p-4 mb-4">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-3">1. Choose Your Collab Partner</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DEMO_BUSINESSES.filter(b => b.collab).map(b => (
                    <button key={b.id} onClick={() => setCollabModal(collabModal?.id === b.id ? null : b)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${collabModal?.id === b.id ? "border-emerald-400/80 bg-emerald-500/10" : "border-white/10 hover:border-white/20 bg-white/5"}`}>
                      <span className="text-2xl">{b.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-zinc-200 truncate">{b.name}</div>
                        <div className="text-[10px] text-zinc-500">{b.type} · {b.location}</div>
                      </div>
                      {collabModal?.id === b.id && <span className="text-emerald-400">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* What's the collab about */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1110] p-4 mb-4">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-3">2. What's the Collab About?</label>
                <textarea value={aiPostIdea} onChange={e => setAiPostIdea(e.target.value)} placeholder="Describe your collaboration... e.g. 'We're doing a joint giveaway — lunch for 2 at our restaurant + a vintage neon sign from their shop'" className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/50 transition" rows={3} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Joint giveaway 🎁", "Cross-promotion 📣", "Event partnership 🎉", "Product bundle 📦", "Community spotlight 🌟"].map(idea => (
                    <button key={idea} onClick={() => setAiPostIdea(prev => prev ? `${prev} — ${idea}` : idea)} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-zinc-500 hover:border-emerald-400/50 hover:text-emerald-400 transition">{idea}</button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button onClick={generateCollabPost} disabled={!collabModal || !aiPostIdea.trim() || generatingPost} className="w-full rounded-xl bg-emerald-400 py-3.5 font-black text-black hover:bg-emerald-300 disabled:opacity-40 transition text-sm">
                {generatingPost ? "✨ Generating your collab post..." : "✨ Generate AI Collab Post"}
              </button>

              {/* Generated post result */}
              {generatedPost && (
                <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-sm">✨ Collab Post Ready</span>
                      <span className="text-[10px] text-zinc-500">with {collabModal?.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(generatedPost)} className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-zinc-400 hover:border-white/20 transition">Copy</button>
                      <Link href="/wovo-ai" className="rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-bold text-black hover:bg-emerald-300 transition">Edit in Wovo AI</Link>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-sans">{generatedPost}</pre>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setAiPostIdea(""); setGeneratedPost(""); setCollabModal(null); }} className="text-xs text-zinc-500 hover:text-zinc-300 transition">Start over</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar — tips */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0d1110] p-4">
                <h3 className="text-sm font-bold text-zinc-300 mb-3">💡 Why Collab?</h3>
                <div className="space-y-3">
                  {[
                    { icon: "👥", title: "Reach new audiences", desc: "Each partner's followers see both businesses" },
                    { icon: "🤝", title: "Build trust faster", desc: "Endorsed by another local business you trust" },
                    { icon: "💸", title: "Split the effort", desc: "One post, two businesses promoting it" },
                    { icon: "🌐", title: "Local network strength", desc: "Tennessee businesses supporting each other" },
                  ].map(item => (
                    <div key={item.title} className="flex gap-2.5">
                      <span className="text-xl">{item.icon}</span>
                      <div><div className="text-xs font-bold text-zinc-300">{item.title}</div><div className="text-[10px] text-zinc-600">{item.desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                <h3 className="text-sm font-bold text-emerald-300 mb-2">📬 Network Guidelines</h3>
                <ul className="space-y-1.5 text-[11px] text-zinc-400">
                  <li>• Keep messages professional and respectful</li>
                  <li>• Only request collabs that make sense for both businesses</li>
                  <li>• Disclose partnerships in your posts</li>
                  <li>• Report spam or inappropriate content</li>
                  <li>• Need help? Email <a href="mailto:support@wovomedia.com" className="text-emerald-400">support@wovomedia.com</a></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

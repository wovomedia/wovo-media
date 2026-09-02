"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { getActiveSession } from "@/lib/supabase/session-client";
import { defaultPublicMode, estimatePublicCredits, publicModeLabel, PUBLIC_MODEL_CATALOG, routeAdamPrompt, type PublicCreationType, type PublicGenerationMode } from "@/lib/ai/public-model-catalog";

type IconName = "create" | "explore" | "calendar" | "assets" | "projects" | "inbox" | "connections" | "support" | "settings" | "search" | "mic" | "plus" | "arrow" | "image" | "video" | "audio" | "social" | "cartoon" | "spark" | "close";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    create: <><path d="M12 3v18M3 12h18" /><path d="m18 5 1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" /></>,
    explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    assets: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 16 3-3 2 2 3-4 3 5M8 9h.01" /></>,
    projects: <><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2" /></>,
    inbox: <><path d="M4 4h16l2 10v6H2v-6L4 4Z" /><path d="M2 14h5l2 3h6l2-3h5" /></>,
    connections: <><circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m8.6 10.5 6.8-3M8.6 13.5l6.8 3" /></>,
    support: <><circle cx="12" cy="12" r="9" /><path d="M9.4 9a2.8 2.8 0 1 1 4.4 2.3c-1.1.8-1.8 1.3-1.8 2.7M12 18h.01" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m6 17 4-4 3 3 2-2 3 3M8 9h.01" /></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="3" /><path d="m17 10 4-2v8l-4-2" /></>,
    audio: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    social: <><path d="M7 12a5 5 0 1 0 5-5" /><path d="M12 3v4h4M12 12l7-7M16 12h5v9H7v-5" /></>,
    cartoon: <><rect x="4" y="3" width="16" height="18" rx="5" /><circle cx="9" cy="11" r="1" /><circle cx="15" cy="11" r="1" /><path d="M9 16c2 1 4 1 6 0M8 7l2 2M16 7l-2 2" /></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

export type CreationAvailability = Record<PublicCreationType, boolean>;

type ComposerTab = "adam" | PublicCreationType;

const TYPES: Array<{ id: ComposerTab; label: string; icon: IconName }> = [
  { id: "adam", label: "Adam", icon: "spark" },
  { id: "image", label: "Image", icon: "image" },
  { id: "video", label: "Video", icon: "video" },
  { id: "audio", label: "Audio", icon: "audio" },
  { id: "social", label: "Social", icon: "social" },
  { id: "cartoon", label: "Cartoon", icon: "cartoon" },
];

const NAV = [
  ["Create", "create"], ["Explore", "explore"], ["Calendar", "calendar"], ["Assets", "assets"], ["Projects", "projects"],
  ["Inbox", "inbox"], ["Connections", "connections"], ["Support", "support"], ["Settings", "settings"],
] as Array<[string, IconName]>;

const EXPLORE = [
  { title: "Restaurant launch film", type: "Video", model: "Wan 2.2 Turbo", image: "/wovo-creator-hero.png", position: "74% 48%" },
  { title: "Character-led campaign", type: "Cartoon", model: "FLUX 2", image: "/wovo-product-scenes.png", position: "2% 2%" },
  { title: "Product moodboard", type: "Image", model: "FLUX 2", image: "/wovo-product-scenes-2.png", position: "99% 3%" },
  { title: "Vertical social concept", type: "Social", model: "Adam Auto", image: "/wovo-product-scenes.png", position: "99% 99%" },
];

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export default function WovoCreateExperience({ availability }: { availability: CreationAvailability }) {
  const router = useRouter();
  const [tab, setTab] = useState<ComposerTab>("adam");
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState("adam-auto");
  const [ratio, setRatio] = useState<"1:1" | "9:16" | "16:9">("1:1");
  const [mode, setMode] = useState<PublicGenerationMode>("prompt-to-image");
  const [outputCount, setOutputCount] = useState<1 | 2 | 4>(1);
  const [audioDuration, setAudioDuration] = useState<30 | 60 | 120 | 180>(30);
  const [modelOpen, setModelOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [referenceData, setReferenceData] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const adamIntent = tab === "adam" ? routeAdamPrompt(prompt) : null;
  const type: PublicCreationType = tab === "adam" ? (adamIntent && adamIntent.kind === "create" ? adamIntent.type : "image") : tab;
  const typeAvailable = availability[type] !== false;
  const showControls = tab !== "adam";
  const showSummary = tab !== "adam" || adamIntent?.kind === "create";
  const availableModels = useMemo(() => PUBLIC_MODEL_CATALOG.filter((model) => model.types.includes(type)), [type]);
  const selectedModel = availableModels.find((model) => model.id === modelId) ?? availableModels[0];
  const ratioOptions = type === "video" || type === "cartoon" ? (["9:16"] as const) : type === "audio" ? (["1:1"] as const) : selectedModel.supportedRatios;
  const activeRatio = ratioOptions.includes(ratio as never) ? ratio : ratioOptions[0];
  const credits = estimatePublicCredits({ type, modelId: selectedModel.id, outputCount, durationSeconds: audioDuration });
  const duration = type === "video" || type === "cartoon" ? "Model-set short clip" : type === "audio" ? `${audioDuration} sec` : "Not applicable";
  const resolutionLabel = type === "video" || type === "cartoon" ? "720p" : type === "audio" ? "Audio" : "Standard";
  const audioLabel = type === "audio" ? "Audio output" : type === "video" || type === "cartoon" ? "Off · model has no native audio" : "Not applicable";
  const effectiveOutputCount = type === "image" || type === "social" ? outputCount : 1;

  function chooseType(next: ComposerTab) {
    setTab(next);
    setModelId("adam-auto");
    setOutputCount(1);
    setAudioDuration(30);
    if (next === "adam") return;
    setMode(defaultPublicMode(next));
    setRatio(next === "video" || next === "cartoon" ? "9:16" : "1:1");
  }

  function startSpeech() {
    setSpeechError("");
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("Voice input is not supported in this browser. You can keep typing your prompt.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setPrompt((current) => `${current}${current && transcript ? " " : ""}${transcript}`.trim());
    };
    recognition.onerror = () => { setListening(false); setSpeechError("WOVO could not hear that clearly. Try again or type your prompt."); };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  function attachReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReferenceName(file.name);
    setReferenceData(null);
    if (file.size <= 1_000_000) {
      const reader = new FileReader();
      reader.onload = () => setReferenceData(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(file);
    }
  }

  async function generate() {
    if (prompt.trim().length < 6) { setGenerateError("Describe what you want to create first."); return; }
    if (!typeAvailable) { setGenerateError(`WOVO cannot make ${type} yet. Pick another type and nothing will be charged.`); return; }
    setGenerateError("");
    const intent = { prompt: prompt.trim(), type, modelId: selectedModel.id, ratio: activeRatio, mode, outputCount: effectiveOutputCount, durationSeconds: type === "audio" ? audioDuration : null, durationLabel: duration, resolution: resolutionLabel, audio: audioLabel, credits: showSummary ? credits : 0, adam: tab === "adam" && adamIntent ? { kind: adamIntent.kind, summary: adamIntent.summary } : null, referenceName: referenceName || null, referenceData, createdAt: new Date().toISOString() };
    localStorage.setItem("wovo-generation-intent", JSON.stringify(intent));
    const session = await getActiveSession();
    if (session) { router.push("/portal?resume=1"); return; }
    setAuthOpen(true);
  }

  return (
    <main className="wm-v2-root min-h-screen bg-[#0b0b0c] text-[#f7f4ee]">
      <div className="grid min-h-screen lg:grid-cols-[238px_minmax(0,1fr)]">
        <aside className={`${mobileOpen ? "fixed inset-0 z-50 flex" : "hidden"} flex-col border-r border-white/10 bg-[#101011] p-4 lg:sticky lg:top-0 lg:flex lg:h-screen`}>
          <div className="flex min-h-12 items-center justify-between px-2">
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="WOVO home"><span className="text-[21px] font-black tracking-[-.075em]">WOVO</span><span className="rounded-full border border-white/20 px-2 py-1 text-[8px] font-bold uppercase tracking-[.2em] text-white/55">AI</span></Link>
            <button onClick={() => setMobileOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 lg:hidden" aria-label="Close navigation"><Icon name="close" /></button>
          </div>
          <nav className="mt-6 space-y-1" aria-label="Product navigation">
            {NAV.map(([label, icon], index) => <Link key={label} href={label === "Create" ? "/" : label === "Explore" ? "#explore" : label === "Support" ? "/contact" : "/login?next=/portal"} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${index === 0 ? "bg-[#f05a3a] text-[#120d0b]" : "text-white/62 hover:bg-white/[.06] hover:text-white"}`}><Icon name={icon} className="h-[18px] w-[18px]" />{label}</Link>)}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.035] p-3.5"><p className="text-xs font-semibold text-white">10 free credits</p><p className="mt-1 text-[11px] leading-4 text-white/45">Included when you create an account. No card required.</p><Link href="/pricing" className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-white text-xs font-bold text-black">View pricing</Link></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Link href="/login?next=/portal" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 text-xs font-semibold text-white/70">Sign in</Link><Link href="/signup?next=/portal" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#f05a3a]/40 text-xs font-semibold text-[#ff8c70]">Create account</Link></div>
        </aside>

        <section className="min-w-0">
          <header className="flex min-h-16 items-center justify-between border-b border-white/10 px-4 sm:px-7 lg:px-10">
            <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 lg:hidden" aria-label="Open navigation"><span className="space-y-1"><span className="block h-px w-4 bg-white" /><span className="block h-px w-4 bg-white" /><span className="block h-px w-4 bg-white" /></span></button>
            <button className="hidden min-h-10 items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] px-4 text-sm text-white/45 transition hover:border-white/20 hover:text-white sm:flex" onClick={() => document.getElementById("create-prompt")?.focus()}><Icon name="search" className="h-4 w-4" />Ask Adam or search your workspace<span className="ml-8 rounded-md border border-white/10 px-2 py-1 text-[10px]">⌘ K</span></button>
            <div className="ml-auto flex items-center gap-2"><Link href="/pricing" className="hidden min-h-10 items-center rounded-xl px-4 text-sm text-white/65 hover:text-white sm:inline-flex">Pricing</Link><Link href="/login?next=/portal" className="inline-flex min-h-10 items-center rounded-xl border border-white/12 px-4 text-sm font-semibold">Sign in</Link></div>
          </header>

          <div className="mx-auto max-w-[1180px] px-4 pb-16 pt-10 sm:px-7 sm:pt-16 lg:px-10 lg:pt-20">
            <section className="mx-auto max-w-[900px] text-center"><span className="inline-flex items-center gap-2 rounded-full border border-[#f05a3a]/25 bg-[#f05a3a]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.13em] text-[#ff8c70]"><span className="h-1.5 w-1.5 rounded-full bg-[#f05a3a]" />10 free credits · no card</span><h1 className="mt-6 text-[clamp(2.6rem,6vw,5rem)] font-medium leading-[.96] tracking-[-.055em]">What do you want WOVO to handle?</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/50">Create content, find past work, plan campaigns, or ask Adam for help. Type it or say it — Adam routes the job and shows the exact credit cost first.</p></section>

            <section className="mx-auto mt-10 max-w-[960px]">
              <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Creation type">{TYPES.map((item) => { const enabled = item.id === "adam" || availability[item.id] !== false; return <button key={item.id} onClick={() => enabled && chooseType(item.id)} disabled={!enabled} title={enabled ? undefined : `${item.label} is not available yet`} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${tab === item.id ? "bg-white text-black" : enabled ? "border border-white/10 bg-white/[.03] text-white/55 hover:text-white" : "cursor-not-allowed border border-white/[.06] bg-transparent text-white/22"}`} aria-pressed={tab === item.id}><Icon name={item.icon} className="h-4 w-4" />{item.label}</button>; })}</div>
              <div className="mt-5 overflow-hidden rounded-[28px] border border-white/14 bg-[#151516] shadow-[0_32px_100px_rgba(0,0,0,.45)] focus-within:border-[#f05a3a]/55">
                <textarea id="create-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={tab === "adam" ? "Ask Adam anything or tell WOVO what you want to accomplish…" : `Describe the ${type} you want to create…`} className="min-h-40 w-full resize-none bg-transparent px-5 pb-3 pt-6 text-lg leading-8 text-white outline-none placeholder:text-white/28 sm:min-h-48 sm:px-7 sm:text-xl" />
                <div className="flex flex-col gap-3 border-t border-white/10 p-3.5 sm:flex-row sm:items-center sm:p-4">
                  <div className="flex flex-wrap items-center gap-2"><input ref={fileInput} type="file" accept="image/*,video/*,audio/*" className="sr-only" onChange={attachReference} /><button onClick={() => fileInput.current?.click()} className="inline-flex min-h-10 max-w-44 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-white/65 hover:text-white" aria-label="Add a reference"><Icon name="plus" className="h-4 w-4 shrink-0" /><span className="truncate">{referenceName || "Add reference"}</span></button><button onClick={() => setModelOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-white/75 hover:border-[#f05a3a]/40"><Icon name="spark" className="h-4 w-4 text-[#ff7659]" />{selectedModel.name}<span className="text-white/35">⌄</span></button><div className="flex rounded-xl border border-white/10 p-1">{ratioOptions.map((item) => <button key={item} onClick={() => setRatio(item)} className={`min-h-8 rounded-lg px-2.5 text-[11px] font-semibold ${activeRatio === item ? "bg-white/12 text-white" : "text-white/38"}`}>{item}</button>)}</div><button onClick={startSpeech} className={`grid h-10 w-10 place-items-center rounded-xl border transition ${listening ? "border-[#f05a3a] bg-[#f05a3a] text-black" : "border-white/10 text-white/55 hover:text-white"}`} aria-label={listening ? "Listening" : "Speak your prompt"}><Icon name="mic" className="h-4 w-4" /></button></div>
                  <div className="ml-auto flex items-center justify-end gap-3"><div className="text-right"><p className="text-sm font-bold">{!typeAvailable ? "Unavailable" : showSummary ? `${credits} credits` : "No credits"}</p><p className="text-[10px] text-white/38">{showSummary ? "Exact estimate" : "Finding and planning are free"}</p></div><button onClick={() => void generate()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#f05a3a] px-5 text-sm font-black text-[#140b08] shadow-[0_10px_35px_rgba(240,90,58,.28)] hover:bg-[#ff7659]">Generate <Icon name="arrow" className="h-4 w-4" /></button></div>
                </div>
              </div>
              {speechError || generateError ? <p className="mt-3 text-center text-sm text-[#ff8c70]">{speechError || generateError}</p> : null}
              {!typeAvailable && !speechError && !generateError ? <p className="mt-3 text-center text-sm text-white/45">WOVO cannot make {type} yet, so it is not offered here. Nothing will be charged.</p> : null}
              {typeAvailable && tab === "adam" && adamIntent && !speechError && !generateError ? <p className="mt-3 text-center text-sm text-white/45">{adamIntent.summary}{adamIntent.kind === "create" ? ` · ${credits} WOVO Credits` : " · no credits used"}</p> : null}
              {showControls ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Mode</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(type === "image" ? (["prompt-to-image", "reference-to-image"] as const) : type === "video" ? (["text-to-video", "image-to-video"] as const) : [defaultPublicMode(type)]).map((item) => <button key={item} onClick={() => setMode(item)} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${mode === item ? "border-[#f05a3a] bg-[#f05a3a]/10 text-[#ff8c70]" : "border-white/10 text-white/48"}`}>{publicModeLabel(item)}</button>)}
                  </div>
                </div>
                {type === "image" || type === "social" ? <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Outputs</p><div className="mt-2 flex gap-2">{([1, 2, 4] as const).map((item) => <button key={item} onClick={() => setOutputCount(item)} className={`min-h-9 flex-1 rounded-lg border text-xs font-semibold ${outputCount === item ? "border-[#f05a3a] bg-[#f05a3a]/10 text-[#ff8c70]" : "border-white/10 text-white/48"}`}>{item}</button>)}</div></div> : null}
                {type === "audio" ? <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Duration</p><div className="mt-2 grid grid-cols-4 gap-2">{([30, 60, 120, 180] as const).map((item) => <button key={item} onClick={() => setAudioDuration(item)} className={`min-h-9 rounded-lg border text-xs font-semibold ${audioDuration === item ? "border-[#f05a3a] bg-[#f05a3a]/10 text-[#ff8c70]" : "border-white/10 text-white/48"}`}>{item < 60 ? `${item}s` : `${item / 60}m`}</button>)}</div></div> : null}
                {type === "video" || type === "cartoon" ? <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Quality</p><div className="mt-2 flex gap-2"><span className="inline-flex min-h-9 items-center rounded-lg border border-[#f05a3a] bg-[#f05a3a]/10 px-3 text-xs font-semibold text-[#ff8c70]">720p</span><span className="inline-flex min-h-9 items-center rounded-lg border border-white/8 px-3 text-xs text-white/28">1080p unavailable</span><span className="inline-flex min-h-9 items-center rounded-lg border border-white/8 px-3 text-xs text-white/28">4K unavailable</span></div></div> : null}
              </div>
              ) : null}
              {showSummary ? <p className="mt-3 text-center text-sm text-white/55"><span className="font-semibold text-white">{selectedModel.name}</span>{type === "audio" ? ` · ${audioDuration}s` : type === "video" || type === "cartoon" ? " · 720p vertical" : ` · ${activeRatio}`}{effectiveOutputCount > 1 ? ` · ${effectiveOutputCount} outputs` : ""} · <span className="font-semibold text-[#ff8c70]">{credits} WOVO Credits</span></p> : null}
              <p className="mt-3 text-center text-[11px] leading-5 text-white/32">The selected model controls only the capabilities it truly supports. WOVO confirms the same total again before a paid job starts.</p>
            </section>

            <section id="explore" className="mt-20 scroll-mt-8"><div className="flex items-end justify-between gap-5"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff7659]">Explore WOVO</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">Start from a real creative direction</h2></div><button className="hidden min-h-10 items-center gap-2 text-sm font-semibold text-white/55 hover:text-white sm:inline-flex" onClick={() => setModelOpen(true)}>Browse models <Icon name="arrow" className="h-4 w-4" /></button></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{EXPLORE.map((item, index) => <button key={item.title} onClick={() => { setPrompt(`Create a polished ${item.title.toLowerCase()} for my brand.`); setTab(index === 0 ? "video" : index === 1 ? "cartoon" : index === 2 ? "image" : "social"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#141415] text-left transition hover:-translate-y-1 hover:border-white/22"><div className="relative h-48 overflow-hidden"><Image src={item.image} alt="" fill sizes="(max-width: 640px) 100vw, 25vw" className={`object-cover transition duration-700 group-hover:scale-110 ${index === 0 ? "wm-media-drift" : ""}`} style={{ objectPosition: item.position }} /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" /><span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur">{item.type}</span></div><div className="p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-white/38">Made with {item.model}</p></div></button>)}</div></section>
          </div>
        </section>
      </div>

      {modelOpen ? <div className="fixed inset-0 z-[70] flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="model-title"><section className="max-h-[90vh] w-full overflow-y-auto rounded-t-[30px] border border-white/12 bg-[#151516] p-5 shadow-2xl sm:max-w-[900px] sm:rounded-[30px] sm:p-7"><div className="flex items-start justify-between gap-5"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#ff7659]">WOVO model browser</p><h2 id="model-title" className="mt-2 text-3xl font-semibold">Choose a model</h2><p className="mt-2 text-sm text-white/45">Only verified models for {type} are shown. Infrastructure details stay private.</p></div><button onClick={() => setModelOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Close model browser"><Icon name="close" /></button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{availableModels.map((model) => <button key={model.id} onClick={() => { setModelId(model.id); setRatio(model.supportedRatios[0]); setModelOpen(false); }} className={`rounded-2xl border p-5 text-left transition ${selectedModel.id === model.id ? "border-[#f05a3a] bg-[#f05a3a]/8" : "border-white/10 bg-white/[.025] hover:border-white/25"}`}><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">{model.name}</h3><p className="mt-2 text-sm leading-6 text-white/45">{model.description}</p></div><span className="shrink-0 rounded-full bg-white/[.07] px-2.5 py-1 text-[10px] font-bold uppercase text-white/55">{model.quality}</span></div><div className="mt-5 flex flex-wrap gap-2">{model.badges.map((badge) => <span key={badge} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/45">{badge}</span>)}<span className="ml-auto text-xs font-bold text-[#ff8c70]">from {estimatePublicCredits({ type, modelId: model.id, outputCount: 1, durationSeconds: 30 })} credits</span></div></button>)}</div></section></div> : null}

      {authOpen ? <div className="fixed inset-0 z-[80] grid place-items-end bg-black/75 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="auth-title"><section className="w-full max-w-md rounded-t-[28px] border border-white/12 bg-[#171718] p-6 shadow-2xl sm:rounded-[28px]"><div className="flex items-start justify-between gap-4"><div><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f05a3a] text-black"><Icon name="spark" /></span><h2 id="auth-title" className="mt-5 text-3xl font-semibold">Save your prompt and start creating.</h2></div><button onClick={() => setAuthOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Close sign in dialog"><Icon name="close" /></button></div><p className="mt-4 text-sm leading-6 text-white/48">{showSummary ? `Your prompt, model, and ${credits}-credit estimate are saved on this device.` : "Your request is saved on this device."} Create an account for 10 one-time starter credits—no card required.</p><div className="mt-7 space-y-3"><Link href="/signup?next=%2Fportal%3Fresume%3D1" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f05a3a] text-sm font-black text-black">Create free account</Link><Link href="/login?next=%2Fportal%3Fresume%3D1" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/12 text-sm font-semibold">Sign in</Link></div><p className="mt-5 text-center text-[11px] text-white/32">By continuing, you agree to WOVO’s Terms and Privacy Policy.</p></section></div> : null}
    </main>
  );
}

'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

export default function AdminWebsiteBuilder() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [step, setStep] = useState(0)
  const [researching, setResearching] = useState(false)
  const [researchData, setResearchData] = useState('')
  const [generating, setGenerating] = useState(false)
  const [files, setFiles] = useState<Record<string,string>>({})
  const [activeFile, setActiveFile] = useState('page.tsx')
  const [d, setD] = useState({
    businessName:'', businessType:'', location:'', tagline:'', style:'Modern & Clean',
    description:'', phone:'', email:'', address:'', hours:'',
    currentWebsite:'', instagram:'', facebook:'', tiktok:'', youtube:'', google:'',
    pages:'Home, About, Services, Contact', staffMembers:'', menuItems:'', services:'',
    testimonials:'', logoUrl:'', aboutStory:''
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { window.location.replace('/login'); return }
      supabase.from('clients').select('id,business_name,owner_name,email').eq('is_active', true).order('business_name')
        .then(({ data }) => setClients(data || []))
    })
  }, [])

  // Auto-fill from selected client
  const handleClientSelect = async (clientId: string) => {
    setSelectedClient(clientId)
    if (!clientId) return
    const client = clients.find(c => c.id === clientId)
    if (client) setD(p => ({ ...p, businessName: client.business_name, email: client.email }))
  }

  const doResearch = async () => {
    if (!d.businessName) return
    setResearching(true)
    try {
      const res = await fetch(`/api/website-builder?name=${encodeURIComponent(d.businessName)}&location=${encodeURIComponent(d.location)}`)
      const data = await res.json()
      setResearchData(data.research || '')
    } catch {}
    setResearching(false)
  }

  const generate = async () => {
    setStep(4); setGenerating(true)
    const res = await fetch('/api/website-builder', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({...d, researchData})
    })
    const data = await res.json()
    setFiles(data.files || {})
    setActiveFile('page.tsx')
    setGenerating(false); setStep(5)
  }

  const downloadAll = () => {
    const content = Object.entries(files).map(([path, code]) =>
      `${'='.repeat(60)}\n// FILE: ${path}\n${'='.repeat(60)}\n${code}`
    ).join('\n\n')
    const blob = new Blob([content], {type:'text/plain'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${d.businessName.toLowerCase().replace(/\s+/g,'-')}-website.txt`; a.click()
  }

  const progress = ['Basics', 'Contact & Online', 'Content', 'Branding', 'Generate']

  if (step === 4) return (
    <AppShell>
      <div style={{padding:'80px 20px',textAlign:'center'}}>
        <div style={{width:52,height:52,border:'3px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',margin:'0 auto 20px',animation:'spin 1s linear infinite'}}/>
        <h3 style={{fontSize:20,fontWeight:600,color:'var(--text)',marginBottom:8}}>Building {d.businessName}...</h3>
        <p style={{color:'var(--text-2)',fontSize:14}}>Generating Nav, Hero, About, Services, Contact, Footer components</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </AppShell>
  )

  if (step === 5 && Object.keys(files).length > 0) return (
    <AppShell>
      <div style={{padding:'20px',maxWidth:1200,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <div>
            <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)',marginBottom:2}}>🎉 {d.businessName} — Ready</h2>
            <p style={{fontSize:12,color:'var(--text-3)'}}>{Object.keys(files).length} files · Next.js + Tailwind</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setStep(0);setFiles({})}}>New site</button>
            <button className="btn btn-primary btn-sm" onClick={downloadAll}>⬇ Download all files</button>
          </div>
        </div>
        <div style={{display:'flex',gap:0,border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',height:'calc(100vh - 200px)'}}>
          <div style={{width:210,background:'var(--bg-2)',borderRight:'1px solid var(--border)',overflowY:'auto',flexShrink:0}}>
            <div style={{padding:'10px 12px',fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:'1px solid var(--border)'}}>
              {Object.keys(files).length} files
            </div>
            {Object.keys(files).map(path => (
              <button key={path} onClick={()=>setActiveFile(path)} style={{
                display:'block',width:'100%',textAlign:'left',padding:'8px 12px',fontSize:12,
                fontFamily:'monospace',cursor:'pointer',border:'none',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                background:activeFile===path?'var(--accent-dim)':'transparent',
                color:activeFile===path?'var(--accent)':'var(--text-2)',
                borderLeft:`2px solid ${activeFile===path?'var(--accent)':'transparent'}`
              }}>
                {path.includes('/') ? <><span style={{color:'var(--text-3)'}}>└ </span>{path.split('/').pop()}</> : path}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflow:'auto',background:'#0d0d0d'}}>
            <pre style={{margin:0,padding:16,fontSize:12,lineHeight:1.6,color:'#e2e8f0',fontFamily:'monospace',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
              {files[activeFile]}
            </pre>
          </div>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div style={{padding:'24px 20px',maxWidth:700,margin:'0 auto'}}>
        <h1 style={{fontFamily:'Outfit,sans-serif',fontSize:26,fontWeight:800,color:'var(--text)',marginBottom:4,letterSpacing:'-0.03em'}}>
          Website <span style={{color:'var(--accent)'}}>Builder</span>
        </h1>
        <p style={{color:'var(--text-3)',fontSize:14,marginBottom:20}}>Build a multi-file Next.js website for any client. Generates Nav, Hero, About, Services, Contact + Footer.</p>

        {/* Client picker */}
        <div className="card" style={{marginBottom:20,padding:'14px 16px'}}>
          <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:600}}>Build for client (optional — auto-fills their info)</label>
          <select className="input" value={selectedClient} onChange={e=>handleClientSelect(e.target.value)}>
            <option value="">Select a client or fill in manually below</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name} — {c.owner_name}</option>)}
          </select>
        </div>

        {/* Progress bar */}
        <div style={{display:'flex',gap:4,marginBottom:8}}>
          {progress.map((p,i) => (
            <div key={p} style={{flex:1,height:3,borderRadius:2,background:i<=step?'var(--accent)':'var(--bg-4)',transition:'background 0.3s',cursor:i<step?'pointer':'default'}} onClick={()=>i<step&&setStep(i)}/>
          ))}
        </div>
        <div style={{fontSize:11,color:'var(--text-3)',marginBottom:18,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>Step {step+1} of 4 — {progress[step]}</div>

        {step===0 && (
          <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Business name<span style={{color:'var(--accent)'}}>*</span></label>
              <input className="input" value={d.businessName} onChange={e=>{const v=e.target.value;setD(p=>({...p,businessName:v}))}} placeholder="Business name"/></div>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Business type<span style={{color:'var(--accent)'}}>*</span></label>
              <select className="input" value={d.businessType} onChange={e=>setD(p=>({...p,businessType:e.target.value}))}>
                <option value="">Select type...</option>
                {['Restaurant / Food & Drink','Bar / Nightlife','Coffee Shop / Cafe','Retail / Boutique','Hair / Beauty Salon','Spa / Wellness','Healthcare / Medical','Auto / Car Services','HVAC / Plumbing / Electrical','Landscaping / Lawn Care','Cleaning Services','Photography / Videography','Real Estate','Gym / Fitness','Law / Legal Services','Accounting / Finance','Other'].map(o=><option key={o}>{o}</option>)}
              </select></div>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>City, State<span style={{color:'var(--accent)'}}>*</span></label>
              <input className="input" value={d.location} onChange={e=>{const v=e.target.value;setD(p=>({...p,location:v}))}} placeholder="City, State"/></div>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Tagline</label>
              <input className="input" value={d.tagline} onChange={e=>{const v=e.target.value;setD(p=>({...p,tagline:v}))}} placeholder="What makes them special"/></div>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:500}}>Website style</label>
              <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                {['Modern & Clean','Bold & Vibrant','Minimal','Warm & Friendly','Luxury','Fun & Playful'].map(s=>(
                  <button key={s} onClick={()=>setD(p=>({...p,style:s}))} style={{padding:'7px 14px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',fontWeight:500,borderColor:d.style===s?'var(--accent)':'var(--border-2)',background:d.style===s?'var(--accent-dim)':'transparent',color:d.style===s?'var(--accent)':'var(--text-2)'}}>{s}</button>
                ))}
              </div></div>
            <button className="btn btn-primary" style={{padding:12,marginTop:4}} onClick={async()=>{setStep(1);await doResearch()}} disabled={!d.businessName||!d.businessType||!d.location}>
              Next → {d.businessName && "(we'll research them online)"}
            </button>
          </div>
        )}

        {step===1 && (
          <div className="card" style={{display:'flex',flexDirection:'column',gap:12}}>
            {researching && <div style={{background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'var(--accent)',display:'flex',alignItems:'center',gap:8}}><span style={{width:14,height:14,border:'2px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block',flexShrink:0}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>Researching {d.businessName}...</div>}
            {researchData && !researching && <div style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#22c55e'}}>✓ Found info online — filling in what we can</div>}
            {[['Phone','phone','(555) 000-0000'],['Email','email','hello@business.com'],['Address','address','123 Main St, City, State'],['Hours','hours','Mon–Fri 9am–5pm'],['Current website','currentWebsite','https://...']].map(([l,k,p])=>(
              <div key={k}><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:4,fontWeight:500}}>{l}</label>
                <input className="input" value={d[k as keyof typeof d]} onChange={e=>{const v=e.target.value;setD(p2=>({...p2,[k]:v}))}} placeholder={p}/></div>
            ))}
            <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
              <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Social Media</div>
              {[['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],['google','Google Business']].map(([k,l])=>(
                <div key={k} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span style={{fontSize:12,color:'var(--text-3)',width:80,flexShrink:0,fontWeight:500}}>{l}</span>
                  <input className="input" style={{fontSize:13}} value={d[k as keyof typeof d]} onChange={e=>{const v=e.target.value;setD(p=>({...p,[k]:v}))}} placeholder={`@handle or URL`}/>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setStep(0)}>← Back</button>
              <button className="btn btn-primary" style={{flex:2,padding:12}} onClick={()=>setStep(2)}>Next →</button>
            </div>
          </div>
        )}

        {step===2 && (
          <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
            {[
              ['About / business description','description','Their story, what makes them special...'],
              ['Staff / team (name + role, one per line)','staffMembers','Owner Name — Role\nEmployee Name — Role'],
              ['Menu or products (name + price + description)','menuItems','Item Name — $Price · Description'],
              ['Services (one per line)','services','Service Name — starting at $Price'],
              ['Customer testimonials','testimonials','Great service! — Customer Name'],
            ].map(([l,k,p])=>(
              <div key={k}><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>{l}</label>
                <textarea className="input" value={d[k as keyof typeof d]} onChange={e=>{const v=e.target.value;setD(p2=>({...p2,[k]:v}))}} placeholder={p} rows={3}/></div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{flex:2,padding:12}} onClick={()=>setStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {step===3 && (
          <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Pages / sections to include</label>
              <input className="input" value={d.pages} onChange={e=>{const v=e.target.value;setD(p=>({...p,pages:v}))}} placeholder="Home, About, Services, Contact"/></div>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Logo URL (optional)</label>
              <input className="input" value={d.logoUrl} onChange={e=>{const v=e.target.value;setD(p=>({...p,logoUrl:v}))}} placeholder="https://..."/></div>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Brand story / extra context</label>
              <textarea className="input" value={d.aboutStory} onChange={e=>{const v=e.target.value;setD(p=>({...p,aboutStory:v}))}} placeholder="Origin story, mission, anything extra..." rows={3}/></div>
            {researchData && (
              <div style={{background:'var(--bg-3)',borderRadius:10,padding:12}}>
                <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Research found</div>
                <p style={{fontSize:12,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{researchData.slice(0,300)}{researchData.length>300?'...':''}</p>
              </div>
            )}
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{flex:2,padding:13,fontSize:14}} onClick={generate}>
                Generate Website ✨
              </button>
            </div>
            <p style={{fontSize:11,color:'var(--text-3)',textAlign:'center'}}>~30 seconds · Generates 7+ component files</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}

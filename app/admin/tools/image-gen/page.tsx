'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const STYLES = ['Photorealistic','Cinematic','Bold Graphic','Minimal Clean','Warm Lifestyle','Dark & Moody','Bright & Vibrant','Flat Illustration']
const FORMATS = ['Square (1:1) — Instagram','Portrait (4:5) — Feed','Story (9:16) — Stories/TikTok','Landscape (16:9) — YouTube/Banner']

export default function AdminImageGen() {
  const [clients, setClients] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('Photorealistic')
  const [format, setFormat] = useState('Square (1:1) — Instagram')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{prompt:string,url:string,created:string}[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { window.location.replace('/login'); return }
      supabase.from('clients').select('id,business_name').eq('is_active',true).order('business_name').then(({data})=>setClients(data||[]))
      // Load recent images
      supabase.from('client_images').select('prompt,image_url,created_at').order('created_at',{ascending:false}).limit(20)
        .then(({data})=>setHistory(data?.map(i=>({prompt:i.prompt,url:i.image_url,created:i.created_at}))||[]))
    })
  }, [])

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setError(''); setImages([])
    const res = await fetch('/api/images/generate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ prompt: `${prompt}. Style: ${style}. Format: ${format}`, clientId, count: 2 })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Generation failed'); setLoading(false); return }
    setImages(data.images || [])
    setLoading(false)
    // Refresh history
    const {data:h} = await supabase.from('client_images').select('prompt,image_url,created_at').order('created_at',{ascending:false}).limit(20)
    setHistory(h?.map(i=>({prompt:i.prompt,url:i.image_url,created:i.created_at}))||[])
  }

  const download = (url: string) => {
    const a = document.createElement('a'); a.href = url; a.download = 'wovo-image.png'; a.target='_blank'; a.click()
  }

  return (
    <AppShell>
      <div style={{padding:'24px 20px',maxWidth:1100,margin:'0 auto'}}>
        <h1 style={{fontFamily:'Outfit,sans-serif',fontSize:26,fontWeight:800,color:'var(--text)',marginBottom:4,letterSpacing:'-0.03em'}}>
          Image <span style={{color:'var(--accent)'}}>Generator</span>
        </h1>
        <p style={{color:'var(--text-3)',fontSize:14,marginBottom:24}}>Generate AI images for client social media, ads, and content</p>

        <div style={{display:'grid',gridTemplateColumns:'380px 1fr',gap:20}}>
          {/* Controls */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="card">
              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:600}}>For client</label>
                <select className="input" value={clientId} onChange={e=>setClientId(e.target.value)}>
                  <option value="">No client (general)</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
              </div>
            </div>

            <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:600}}>Image prompt</label>
                <textarea className="input" value={prompt} onChange={e=>setPrompt(e.target.value)}
                  placeholder="Describe the image — e.g. 'A delicious burger on a rustic wooden table, golden hour lighting, steam rising, restaurant atmosphere'"
                  rows={4} style={{fontSize:14}}/>
              </div>

              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:8,fontWeight:600}}>Visual style</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {STYLES.map(s=>(
                    <button key={s} onClick={()=>setStyle(s)} style={{padding:'5px 11px',borderRadius:16,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',fontWeight:500,borderColor:style===s?'var(--accent)':'var(--border)',background:style===s?'var(--accent-dim)':'transparent',color:style===s?'var(--accent)':'var(--text-2)'}}>{s}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:8,fontWeight:600}}>Format</label>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {FORMATS.map(f=>(
                    <button key={f} onClick={()=>setFormat(f)} style={{padding:'8px 12px',borderRadius:8,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',fontWeight:500,textAlign:'left',borderColor:format===f?'var(--accent)':'var(--border)',background:format===f?'var(--accent-dim)':'transparent',color:format===f?'var(--accent)':'var(--text-2)'}}>{f}</button>
                  ))}
                </div>
              </div>

              {error && <div className="alert alert-error" style={{fontSize:13}}>{error}</div>}

              <button className="btn btn-primary btn-block" onClick={generate} disabled={loading||!prompt.trim()} style={{padding:13,fontSize:14}}>
                {loading ? (
                  <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                    <span style={{width:15,height:15,border:'2px solid rgba(0,0,0,0.25)',borderTopColor:'#080808',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>
                    Generating...
                  </span>
                ) : 'Generate Images ✨'}
              </button>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </div>

          {/* Results */}
          <div>
            {images.length > 0 && (
              <div style={{marginBottom:20}}>
                <h3 style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:12}}>Generated Images</h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {images.map((url,i)=>(
                    <div key={i} className="card" style={{padding:0,overflow:'hidden'}}>
                      <img src={url} alt={`Generated ${i+1}`} style={{width:'100%',display:'block',aspectRatio:'1',objectFit:'cover'}}/>
                      <div style={{padding:'10px 12px',display:'flex',gap:8}}>
                        <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>download(url)}>⬇ Download</button>
                        <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={()=>navigator.clipboard.writeText(url)}>Copy URL</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && images.length === 0 && (
              <div>
                <h3 style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:12}}>Recent Images</h3>
                {history.length === 0 && <div className="card" style={{textAlign:'center',color:'var(--text-3)',fontSize:13,padding:32}}>No images generated yet</div>}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  {history.map((img,i)=>(
                    <div key={i} className="card" style={{padding:0,overflow:'hidden'}}>
                      <img src={img.url} alt="Generated" style={{width:'100%',display:'block',aspectRatio:'1',objectFit:'cover'}}/>
                      <div style={{padding:'8px 10px'}}>
                        <p style={{fontSize:11,color:'var(--text-3)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{img.prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

'use client'
import Link from 'next/link'

interface Props {
  feature: string
  description?: string
  minimal?: boolean // compact inline version vs full page block
}

export default function UpgradeWall({ feature, description, minimal }: Props) {
  if (minimal) return (
    <div style={{background:'var(--bg-3)',border:'1px solid var(--accent-border)',borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
      <div>
        <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:3}}>🔒 {feature} requires a subscription</div>
        <div style={{fontSize:13,color:'var(--text-2)'}}>{description||'Upgrade to unlock this feature.'}</div>
      </div>
      <div style={{display:'flex',gap:8,flexShrink:0}}>
        <a href="/wovo-ai" style={{textDecoration:'none'}}><button className="btn btn-primary btn-sm" style={{whiteSpace:'nowrap'}}>See Plans →</button></a>
        <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}><button className="btn btn-ghost btn-sm" style={{whiteSpace:'nowrap'}}>Book a Call</button></a>
      </div>
    </div>
  )

  return (
    <div style={{textAlign:'center',padding:'56px 32px',background:'var(--bg-2)',borderRadius:16,border:'1px solid var(--border)',position:'relative',overflow:'hidden'}}>
      {/* Glow */}
      <div style={{position:'absolute',top:-40,left:'50%',transform:'translateX(-50%)',width:200,height:200,background:'radial-gradient(circle,rgba(0,229,200,0.08) 0%,transparent 70%)',pointerEvents:'none'}}/>
      
      <div style={{fontSize:40,marginBottom:16}}>🔒</div>
      <h3 style={{fontSize:20,fontWeight:700,marginBottom:8,color:'var(--text)'}}>{feature}</h3>
      <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.7,marginBottom:28,maxWidth:380,margin:'0 auto 28px'}}>
        {description || `${feature} is available on paid plans. Upgrade to unlock this and all Wovo AI features.`}
      </p>

      {/* Plan pills */}
      <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:24,flexWrap:'wrap'}}>
        {[['Starter','$29/mo','https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y'],['Growth','$49/mo','https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z'],['Pro AI','$79/mo','https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10']].map(([name,price,url])=>(
          <a key={name} href={url} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
            <div style={{padding:'10px 18px',borderRadius:10,background:'var(--bg-3)',border:'1px solid var(--border)',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor='var(--accent)';el.style.background='var(--accent-dim)'}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor='var(--border)';el.style.background='var(--bg-3)'}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{name}</div>
              <div style={{fontSize:12,color:'var(--accent)',fontWeight:600}}>{price}</div>
            </div>
          </a>
        ))}
      </div>

      <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
        <a href="/wovo-ai" style={{textDecoration:'none'}}>
          <button className="btn btn-primary" style={{padding:'11px 24px',fontSize:14}}>See All Plans →</button>
        </a>
        <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
          <button className="btn btn-ghost" style={{padding:'11px 20px',fontSize:14}}>Book a Free Call</button>
        </a>
      </div>
    </div>
  )
}

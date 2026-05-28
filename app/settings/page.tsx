'use client'
import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const [client, setClient] = useState<any>(null)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await supabase.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) setClient(c)
    })
  }, [])

  const [installPrompt, setInstallPrompt] = useState<any>(null)
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); setInstallPrompt(e) })
  }, [])

  return (
    <AppShell user={client}>
      <div style={{padding:'20px 16px 0'}}>
        <h1 className="page-title" style={{marginBottom:20}}>Settings</h1>

        <div className="section-label">App</div>
        <div className="card" style={{marginBottom:14}}>
          {installPrompt && (
            <button className="btn btn-primary btn-block" style={{marginBottom:12}} onClick={()=>{installPrompt.prompt();setInstallPrompt(null)}}>
              📱 Install Wovo App
            </button>
          )}
          <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6}}>
            <strong style={{color:'var(--text)'}}>On iPhone:</strong> tap the Share button → "Add to Home Screen"<br/><br/>
            <strong style={{color:'var(--text)'}}>On Android:</strong> tap the menu (⋮) → "Install app" or "Add to Home Screen"<br/><br/>
            <strong style={{color:'var(--text)'}}>On desktop:</strong> click the install icon (⊕) in your browser address bar
          </div>
        </div>

        <div className="section-label">About</div>
        <div className="card" style={{padding:'14px 16px'}}>
          <div style={{fontFamily:'Outfit,sans-serif',fontSize:18,fontWeight:800,color:'var(--text)',marginBottom:4}}>wovo<span style={{color:'var(--accent)'}}>media</span></div>
          <div style={{fontSize:12,color:'var(--text-3)'}}>Version 1.0 · app.wovomedia.com</div>
        </div>
      </div>
    </AppShell>
  )
}

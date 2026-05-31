'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

export default function Messages() {
  const [client, setClient] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [userName, setUserName] = useState('')
  const msgsEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const data = { user: session?.user }
      if (!data.user) { window.location.replace('/login'); return }
      const { data: c } = await supabase.from('clients').select('*, profiles(full_name)').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        setIsActive(c.is_active)
        setUserName((c.profiles as any)?.full_name || c.owner_name || 'Client')
        const { data: convos } = await supabase.from('conversations').select('*').eq('client_id', c.id).order('last_message_at', { ascending: false })
        setConversations(convos || [])
        if (convos?.[0]) { setActive(convos[0]); loadMessages(convos[0].id) }
      }
    })
  }, [])

  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Real-time subscription
  useEffect(() => {
    if (!active?.id) return
    const sub = supabase.channel(`messages-${active.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${active.id}` },
        payload => setMessages(m => [...m, payload.new])
      ).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [active?.id])

  const loadMessages = async (convoId: string) => {
    const { data } = await supabase.from('conversation_messages').select('*').eq('conversation_id', convoId).order('created_at', { ascending: true })
    setMessages(data || [])
  }

  const send = async () => {
    if (!text.trim() || !active) return
    setSending(true)
    await supabase.from('conversation_messages').insert({
      conversation_id: active.id,
      sender_name: userName,
      sender_role: 'client',
      body: text.trim()
    })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', active.id)
    setText('')
    setSending(false)
  }

  return (
    <AppShell user={client}>
      <div style={{padding:'20px 16px 0',height:'calc(100dvh - 80px)',display:'flex',flexDirection:'column'}}>
        <h1 className="page-title" style={{marginBottom:12}}>Messages</h1>

        {!isActive ? (
          <div className="card card-accent" style={{textAlign:'center',padding:'40px 20px'}}>
            <div style={{fontSize:36,marginBottom:12}}>💬</div>
            <h3 style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:8}}>Messages require a subscription</h3>
            <p style={{fontSize:13,color:'var(--text-2)',marginBottom:16,lineHeight:1.6}}>Upgrade to message your Wovo Media team directly — coordinate shoots, review content, and get updates in real time.</p>
            <a href={`${''}/wovo-ai`} target="_blank" rel="noreferrer"><button className="btn btn-primary" style={{padding:'11px 24px'}}>See Plans →</button></a>
          </div>
        ) : conversations.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>
            <div style={{fontSize:36,marginBottom:12}}>💬</div>
            <p>Your account manager will reach out soon. Check back here for messages from your Wovo Media team.</p>
          </div>
        ) : (
          <>
            {/* Conversation list - if multiple */}
            {conversations.length > 1 && (
              <div style={{display:'flex',gap:8,marginBottom:12,overflowX:'auto',paddingBottom:4}}>
                {conversations.map(c=>(
                  <button key={c.id} onClick={()=>{setActive(c);loadMessages(c.id)}} style={{flexShrink:0,padding:'7px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:'1px solid',borderColor:active?.id===c.id?'var(--accent)':'var(--border)',background:active?.id===c.id?'var(--accent-dim)':'transparent',color:active?.id===c.id?'var(--accent)':'var(--text-3)',whiteSpace:'nowrap'}}>
                    {c.subject||'General'}
                  </button>
                ))}
              </div>
            )}

            {/* Active conversation */}
            {active && (
              <>
                <div style={{background:'var(--bg-3)',borderRadius:10,padding:'10px 14px',marginBottom:10,fontSize:12,color:'var(--text-2)'}}>
                  <span style={{fontWeight:700,color:'var(--text)'}}>{active.subject||'Your Wovo Media Team'}</span>
                  <span style={{color:'var(--text-3)',marginLeft:8}}>· Messages are end-to-end with your team</span>
                </div>

                {/* Messages */}
                <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,paddingBottom:8}}>
                  {messages.map(m=>{
                    const isMe = m.sender_role === 'client'
                    return (
                      <div key={m.id} style={{
                        alignSelf:isMe?'flex-end':'flex-start',
                        maxWidth:'82%',
                        display:'flex',flexDirection:'column',
                        gap:3,
                      }}>
                        {!isMe && <div style={{fontSize:10,color:'var(--text-3)',fontWeight:600,paddingLeft:4}}>{m.sender_name}</div>}
                        <div style={{
                          background:isMe?'var(--accent)':'var(--bg-3)',
                          color:isMe?'#080808':'var(--text-2)',
                          borderRadius:isMe?'14px 14px 3px 14px':'14px 14px 14px 3px',
                          padding:'10px 14px',fontSize:14,lineHeight:1.55,wordBreak:'break-word'
                        }}>
                          {m.body}
                        </div>
                        <div style={{fontSize:10,color:'var(--text-3)',alignSelf:isMe?'flex-end':'flex-start',paddingLeft:isMe?0:4,paddingRight:isMe?4:0}}>
                          {new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={msgsEnd}/>
                </div>

                {/* Input */}
                <div style={{display:'flex',gap:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                  <textarea className="input" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Message your team..." rows={2} style={{flex:1,fontSize:14,resize:'none',lineHeight:1.5}}/>
                  <button className="btn btn-primary" style={{padding:'0 16px',flexShrink:0,alignSelf:'flex-end',height:44}} onClick={send} disabled={sending||!text.trim()}>
                    <i className="ti ti-send" style={{fontSize:18}}/>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

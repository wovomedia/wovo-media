'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const TYPE_COLOR: Record<string,string> = { video:'#00E5C8', photo:'#8b5cf6', both:'#f59e0b' }
const STATUS_COLOR: Record<string,string> = { scheduled:'#f59e0b', confirmed:'#22c55e', in_progress:'#00E5C8', complete:'#22c55e', cancelled:'#ef4444', rescheduled:'#f59e0b' }

export default function Schedule() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [shoots, setShoots] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ clientId:'', title:'', date:'', startTime:'', endTime:'', location:'', address:'', type:'video', notes:'', crew:[] as string[] })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [year, month])

  const loadData = async () => {
    const start = `${year}-${String(month+1).padStart(2,'0')}-01`
    const end = `${year}-${String(month+1).padStart(2,'0')}-31`
    const [s, c, e] = await Promise.all([
      supabase.from('shoot_schedule').select('*, clients(business_name)').gte('scheduled_date', start).lte('scheduled_date', end).order('scheduled_date'),
      supabase.from('clients').select('id, business_name').eq('is_active', true),
      supabase.from('employees').select('id, full_name, role').eq('is_active', true)
    ])
    setShoots(s.data || [])
    setClients(c.data || [])
    setEmployees(e.data || [])
  }

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const shootsOnDay = (day: number) => {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return shoots.filter(s => s.scheduled_date === dateStr)
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1) } else setMonth(m=>m-1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1) } else setMonth(m=>m+1) }

  const saveShoot = async () => {
    if (!form.clientId || !form.title || !form.date) { setMsg('Client, title, and date are required.'); return }
    setSaving(true)
    await supabase.from('shoot_schedule').insert({
      client_id: form.clientId, title: form.title, scheduled_date: form.date,
      start_time: form.startTime || null, end_time: form.endTime || null,
      location: form.location || null, address: form.address || null,
      type: form.type, notes: form.notes || null,
      crew: form.crew, status: 'scheduled'
    })
    setMsg('✓ Shoot scheduled!')
    setShowForm(false)
    setForm({ clientId:'', title:'', date:'', startTime:'', endTime:'', location:'', address:'', type:'video', notes:'', crew:[] })
    await loadData()
    setSaving(false)
  }

  const selectedShoot = shoots.find(s => s.id === selected)

  return (
    <AppShell>
      <div style={{padding:'20px 16px 0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h1 className="page-title">Schedule</h1>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(!showForm)}>+ Shoot</button>
        </div>

        {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:12}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:16}}>×</button></div>}

        {/* New shoot form */}
        {showForm && (
          <div className="card" style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:700}}>Schedule a Shoot</div>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:11}}>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Client *</label>
                <select className="input" value={form.clientId} onChange={e=>setForm(f=>({...f,clientId:e.target.value}))}>
                  <option value="">Select client...</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Title *</label>
                <input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Monthly content shoot"/>
              </div>
              <div className="grid-2">
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Date *</label>
                  <input className="input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Type</label>
                  <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    <option value="video">Video</option>
                    <option value="photo">Photo</option>
                    <option value="both">Video + Photo</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Start time</label>
                  <input className="input" type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>End time</label>
                  <input className="input" type="time" value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Location name</label>
                <input className="input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Mojo Tacos Franklin"/>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Address</label>
                <input className="input" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="123 Main St, Franklin TN"/>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Crew</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {employees.map(emp=>(
                    <button key={emp.id} onClick={()=>setForm(f=>({...f,crew:f.crew.includes(emp.id)?f.crew.filter(id=>id!==emp.id):[...f.crew,emp.id]}))}
                      style={{padding:'6px 12px',borderRadius:20,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',fontWeight:600,
                        borderColor:form.crew.includes(emp.id)?'var(--accent)':'var(--border)',
                        background:form.crew.includes(emp.id)?'var(--accent-dim)':'transparent',
                        color:form.crew.includes(emp.id)?'var(--accent)':'var(--text-3)'}}>
                      {emp.full_name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Notes</label>
                <textarea className="input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Shot list, special requirements, etc." rows={2}/>
              </div>
              <button className="btn btn-primary btn-block" onClick={saveShoot} disabled={saving}>{saving?'Saving...':'Schedule Shoot →'}</button>
            </div>
          </div>
        )}

        {/* Calendar header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <button onClick={prevMonth} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:20,padding:'4px 8px'}}>‹</button>
          <div style={{fontFamily:'Outfit,sans-serif',fontSize:16,fontWeight:700,color:'var(--text)'}}>{MONTHS[month]} {year}</div>
          <button onClick={nextMonth} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:20,padding:'4px 8px'}}>›</button>
        </div>

        {/* Day labels */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:4}}>
          {DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'var(--text-3)',fontWeight:700,padding:'4px 0'}}>{d}</div>)}
        </div>

        {/* Calendar grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:20}}>
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const dayShoots = shootsOnDay(day)
            const isToday = day===today.getDate() && month===today.getMonth() && year===today.getFullYear()
            return (
              <div key={day} style={{minHeight:50,borderRadius:8,background:isToday?'rgba(0,229,200,0.08)':'var(--bg-3)',border:isToday?'1px solid var(--accent-border)':'1px solid transparent',padding:'4px',cursor:dayShoots.length>0?'pointer':'default'}}
                onClick={()=>dayShoots.length>0&&setSelected(dayShoots[0].id)}>
                <div style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?'var(--accent)':'var(--text-3)',marginBottom:2,textAlign:'center'}}>{day}</div>
                {dayShoots.slice(0,2).map(s=>(
                  <div key={s.id} style={{height:4,borderRadius:2,background:TYPE_COLOR[s.type]||'var(--accent)',marginBottom:1}}/>
                ))}
                {dayShoots.length>2 && <div style={{fontSize:8,color:'var(--text-3)',textAlign:'center'}}>+{dayShoots.length-2}</div>}
              </div>
            )
          })}
        </div>

        {/* Selected shoot detail */}
        {selectedShoot && (
          <div className="card card-accent" style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{selectedShoot.title}</div>
                <div style={{fontSize:12,color:'var(--accent)',marginTop:2}}>{selectedShoot.clients?.business_name}</div>
              </div>
              <button onClick={()=>setSelected('')} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:18}}>×</button>
            </div>
            {[
              ['Date', new Date(selectedShoot.scheduled_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})],
              ['Time', selectedShoot.start_time ? `${selectedShoot.start_time}${selectedShoot.end_time?' – '+selectedShoot.end_time:''}` : '—'],
              ['Location', selectedShoot.location || '—'],
              ['Address', selectedShoot.address || '—'],
              ['Type', selectedShoot.type],
              ['Status', selectedShoot.status],
            ].map(([k,v])=> v!=='—' && (
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:13}}>
                <span style={{color:'var(--text-3)'}}>{k}</span>
                <span style={{color:'var(--text)',fontWeight:500,textAlign:'right',maxWidth:'60%',textTransform:'capitalize'}}>{v}</span>
              </div>
            ))}
            {selectedShoot.notes && <p style={{fontSize:12,color:'var(--text-2)',marginTop:8,lineHeight:1.5}}>{selectedShoot.notes}</p>}
            <Link href={`/admin/clients/${selectedShoot.client_id}`} style={{textDecoration:'none'}}>
              <button className="btn btn-outline btn-sm" style={{marginTop:12,width:'100%'}}>Open Client →</button>
            </Link>
          </div>
        )}

        {/* Upcoming shoots list */}
        <div className="section-label">This month — {shoots.length} shoot{shoots.length!==1?'s':''}</div>
        {shoots.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:24,color:'var(--text-3)'}}>No shoots scheduled this month.</div>
        ) : shoots.map(s=>(
          <div key={s.id} className="card" style={{marginBottom:8,padding:'12px 14px',cursor:'pointer',borderLeft:`3px solid ${TYPE_COLOR[s.type]||'var(--accent)'}`}} onClick={()=>setSelected(s.id)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{s.title}</div>
                <div style={{fontSize:11,color:'var(--accent)',marginTop:2}}>{s.clients?.business_name}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>
                  {new Date(s.scheduled_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  {s.start_time ? ' · '+s.start_time : ''}
                  {s.location ? ' · '+s.location : ''}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                <span style={{fontSize:10,fontWeight:700,color:TYPE_COLOR[s.type],textTransform:'uppercase'}}>{s.type}</span>
                <div style={{width:6,height:6,borderRadius:'50%',background:STATUS_COLOR[s.status]||'#666'}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}

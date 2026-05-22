'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'

export default function ClientDashboard() {
  const [client, setClient] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [tab, setTab] = useState<'overview'|'reports'>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await sb.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        const [r, s] = await Promise.all([
          sb.from('client_reports').select('*').eq('client_id', c.id).order('month', { ascending: false }),
          sb.from('client_stats_history').select('*').eq('client_id', c.id).order('recorded_at', { ascending: false }).limit(6)
        ])
        if (r.data) setReports(r.data)
        if (s.data) setStats(s.data)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading your dashboard...</div>
    </div>
  )

  const latest = reports[0]
  const totalViews = stats.reduce((a, s) => a + (s.views || 0), 0)
  const totalEngagements = stats.reduce((a, s) => a + (s.engagements || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="grid-bg" /><div className="grid-fade" />
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '0.5px solid var(--border)', background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 700 }}>wovo<span style={{ color: 'var(--accent)' }}>media</span><span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginLeft: 8 }}>{client?.business_name}</span></div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['overview', 'reports'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? 'var(--accent-dim)' : 'transparent', border: '0.5px solid', borderColor: tab === t ? 'var(--accent-border)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-2)', padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/account"><button className="btn btn-ghost btn-sm">Account</button></Link>
          <button className="btn btn-ghost btn-sm" onClick={() => sb.auth.signOut().then(() => window.location.href = '/')}>Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px', position: 'relative', zIndex: 2 }}>
        {tab === 'overview' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Welcome back{client?.owner_name ? `, ${client.owner_name.split(' ')[0]}` : ''} 👋</h1>
              <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Here's how {client?.business_name} is performing.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
              {[
                ['Total Views', totalViews.toLocaleString(), '📈'],
                ['Total Engagements', totalEngagements.toLocaleString(), '💬'],
                ['Reports Received', reports.length.toString(), '📋'],
              ].map(([l, v, icon]) => (
                <div key={l} className="stat-card">
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                  <div className="stat-num">{v}</div>
                  <div className="stat-label">{l}</div>
                </div>
              ))}
            </div>

            {latest && (
              <div className="card card-accent" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 4 }}>Latest Report</div>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{new Date(latest.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                  </div>
                  <span className="badge badge-green">Latest</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: latest.summary ? 16 : 0 }}>
                  {[['Views', latest.views?.toLocaleString()], ['Engagements', latest.engagements?.toLocaleString()], ['Posts', latest.posts_published]].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne,sans-serif' }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
                {latest.summary && <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, borderTop: '0.5px solid var(--border)', paddingTop: 14, marginTop: 4 }}>{latest.summary}</p>}
              </div>
            )}

            {!latest && (
              <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your first report is on the way</h3>
                <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Payton will send your monthly performance report soon. Check back here to track views, engagements, and more.</p>
              </div>
            )}

            <div className="card" style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Questions or updates?</h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Reach out directly to your account manager.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href="mailto:Payton@wovomedia.com"><button className="btn btn-primary btn-sm">Email Payton</button></a>
                <a href="tel:9314583255"><button className="btn btn-ghost btn-sm">Call / Text</button></a>
              </div>
            </div>
          </>
        )}

        {tab === 'reports' && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Monthly Reports</h2>
            {reports.length === 0
              ? <div className="card" style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--text-3)' }}>No reports yet — check back after your first month.</div>
              : reports.map(r => (
                <div key={r.id} className="card" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{new Date(r.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.sent_at ? new Date(r.sent_at).toLocaleDateString() : ''}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: r.summary ? 14 : 0 }}>
                    {[['Views', r.views], ['Engagements', r.engagements], ['Posts', r.posts_published], ['New Followers', r.new_followers]].map(([l, v]) => (
                      <div key={l} style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '12px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne,sans-serif' }}>{(v as number)?.toLocaleString() || '—'}</div>
                      </div>
                    ))}
                  </div>
                  {r.summary && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>{r.summary}</p>}
                </div>
              ))
            }
          </>
        )}
      </div>
    </div>
  )
}

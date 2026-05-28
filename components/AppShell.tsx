'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const CLIENT_NAV = [
  { href: '/home', icon: 'ti-home', label: 'Home' },
  { href: '/videos', icon: 'ti-video', label: 'Videos' },
  { href: '/studio', icon: 'ti-sparkles', label: 'Studio' },
  { href: '/messages', icon: 'ti-message', label: 'Messages' },
  { href: '/account', icon: 'ti-user', label: 'Account' },
]

const ADMIN_NAV = [
  { href: '/admin', icon: 'ti-layout-dashboard', label: 'Overview' },
  { href: '/admin/clients', icon: 'ti-users', label: 'Clients' },
  { href: '/admin/jobs', icon: 'ti-checklist', label: 'Jobs' },
  { href: '/admin/team', icon: 'ti-id-badge', label: 'Team' },
  { href: '/account', icon: 'ti-user', label: 'Account' },
]

const EMPLOYEE_NAV = [
  { href: '/employee', icon: 'ti-checklist', label: 'My Jobs' },
  { href: '/admin/schedule', icon: 'ti-calendar', label: 'Schedule' },
  { href: '/employee', icon: 'ti-upload', label: 'Upload' },
  { href: '/account', icon: 'ti-user', label: 'Account' },
]

export default function AppShell({ children, user }: { children: React.ReactNode, user?: any }) {
  const path = usePathname()
  const isAdmin = path.startsWith('/admin')
  const isEmployee = path.startsWith('/employee')
  const nav = isAdmin ? ADMIN_NAV : isEmployee ? EMPLOYEE_NAV : CLIENT_NAV

  const SIDE = isAdmin ? [
    { href: '/admin', icon: 'ti-layout-dashboard', label: 'Overview' },
    { href: '/admin/clients', icon: 'ti-users', label: 'Clients' },
    { href: '/admin/jobs', icon: 'ti-checklist', label: 'Jobs' },
    { href: '/admin/team', icon: 'ti-id-badge', label: 'Team' },
    { href: '/admin/schedule', icon: 'ti-calendar', label: 'Schedule' },
    { href: '/admin/ads', icon: 'ti-speakerphone', label: 'Ad Studio' },
    null,
    { href: '/home', icon: 'ti-home', label: 'Client View' },
    { href: '/account', icon: 'ti-user', label: 'Account' },
  ] : isEmployee ? [
    { href: '/employee', icon: 'ti-checklist', label: 'My Jobs' },
    { href: '/admin/schedule', icon: 'ti-calendar', label: 'Schedule' },
    { href: '/account', icon: 'ti-user', label: 'Account' },
  ] : [
    { href: '/home', icon: 'ti-home', label: 'Home' },
    { href: '/videos', icon: 'ti-video', label: 'AI Videos' },
    { href: '/studio', icon: 'ti-sparkles', label: 'Studio' },
    { href: '/messages', icon: 'ti-message', label: 'Messages' },
    { href: '/business', icon: 'ti-building-store', label: 'My Business' },
    null,
    { href: '/account', icon: 'ti-user', label: 'Account' },
    { href: '/settings', icon: 'ti-settings', label: 'Settings' },
  ]

  const active = (href: string) => href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/')

  return (
    <div id="app-shell">
      {/* Desktop side nav */}
      <nav className="side-nav">
        <div style={{padding:'22px 20px 18px',borderBottom:'1px solid var(--border)'}}>
          <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:19,fontWeight:800,letterSpacing:'-0.04em',color:'var(--text)',textDecoration:'none'}}>
            wovo<span style={{color:'var(--accent)'}}>media</span>
          </Link>
          {user?.business_name && <div style={{fontSize:11,color:'var(--text-3)',marginTop:3}}>{user.business_name}</div>}
          {isAdmin && <div style={{fontSize:11,color:'var(--accent)',marginTop:3,fontWeight:600}}>Owner Dashboard</div>}
          {isEmployee && <div style={{fontSize:11,color:'var(--accent)',marginTop:3,fontWeight:600}}>Employee View</div>}
        </div>
        <div style={{flex:1,overflowY:'auto',paddingTop:8}}>
          {SIDE.map((n,i) => n === null
            ? <div key={i} style={{height:1,background:'var(--border)',margin:'8px 16px'}}/>
            : <Link key={n.href} href={n.href} className={`side-nav-item ${active(n.href)?'active':''}`}>
                <i className={`ti ${n.icon}`}/>{n.label}
              </Link>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="app-content">{children}</div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {nav.map(n => (
          <Link key={n.href} href={n.href} className={`bottom-nav-item ${active(n.href)?'active':''}`}>
            <i className={`ti ${n.icon}`}/><span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

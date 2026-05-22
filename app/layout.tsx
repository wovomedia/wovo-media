import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wovo Media — Digital Presence Management',
  description: '11+ clients. 100M+ combined views & engagements. AI-powered content from $29/mo or full-service production.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{__html: `
          try {
            const t = localStorage.getItem('wovo-theme') || 'light';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e){}
        `}}/>
      </head>
      <body>{children}</body>
    </html>
  )
}

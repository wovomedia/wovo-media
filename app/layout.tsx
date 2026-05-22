import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wovo Media — Digital Presence Management',
  description: '11+ clients. 100M+ combined views & engagements. AI-powered content from $29/mo or full-service production.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
        <script dangerouslySetInnerHTML={{__html: `
          try {
            var t = localStorage.getItem('wovo-theme') || 'light';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e){}
        `}}/>
      </head>
      <body>{children}</body>
    </html>
  )
}

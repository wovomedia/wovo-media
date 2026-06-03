import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wovo Media',
  description: 'AI-powered content for your business. Local businesses getting millions of views with Wovo AI.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Wovo Media' },
  other: { 'mobile-web-app-capable': 'yes' }
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  themeColor: '#00E5C8', viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png"/>
        <link rel="icon" href="/icon-192.png"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <script dangerouslySetInnerHTML={{__html:`
          var l=document.createElement('link');
          l.rel='stylesheet';
          l.href='https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css';
          document.head.appendChild(l);
        `}}/>
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}` }}/>
      </body>
    </html>
  )
}

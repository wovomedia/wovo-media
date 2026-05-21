import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wovo Media — Digital Presence Management',
  description: '11+ clients. 100M+ combined views & engagements. AI-powered content from $29/mo or full-service production with a real team behind you.',
  openGraph: {
    title: 'Wovo Media — Your business, seen everywhere.',
    description: 'AI-powered content or full-service production. 11+ clients served. 100M+ views & engagements combined.',
    url: 'https://wovomedia.com',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

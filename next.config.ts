import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: { domains: ['dadbukxeayosvkqcrzfm.supabase.co'] },
  async redirects() {
    return [
      { source: '/dashboard/client', destination: '/home', permanent: false },
      { source: '/dashboard/client/videos', destination: '/videos', permanent: false },
      { source: '/dashboard/client/studio', destination: '/studio', permanent: false },
      { source: '/dashboard/client/business', destination: '/business', permanent: false },
      { source: '/dashboard/owner', destination: '/admin', permanent: false },
      { source: '/dashboard/owner/users', destination: '/admin/clients', permanent: false },
      { source: '/dashboard/owner/team', destination: '/admin/team', permanent: false },
      { source: '/dashboard/owner/videos', destination: '/admin/jobs', permanent: false },
      { source: '/dashboard/owner/ads', destination: '/admin/ads', permanent: false },
      { source: '/dashboard/team', destination: '/employee', permanent: false },
    ]
  },
}

export default nextConfig

import SiteFooter from '@/components/SiteFooter'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SeatBelt',
  description: 'Peer-to-peer community rideshare. No surge pricing. Ever.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children} <SiteFooter /></body>
    </html>
  )
}
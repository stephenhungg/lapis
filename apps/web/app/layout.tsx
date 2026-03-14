import React from "react"
import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const instrumentSans = Instrument_Sans({ 
  subsets: ["latin"],
  variable: '--font-instrument'
});

const instrumentSerif = Instrument_Serif({ 
  subsets: ["latin"],
  weight: "400",
  variable: '--font-instrument-serif'
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

const siteUrl = 'https://lapis.bet'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Lapis — AI-Powered Startup Valuations on XRPL',
    template: '%s | Lapis',
  },
  description: 'AI agent that analyzes startups, runs prediction markets, and settles equity on the XRP Ledger. Get crowd-consensus valuations backed by on-chain settlement.',
  keywords: ['startup valuation', 'XRPL', 'prediction market', 'equity token', 'AI analysis', 'MPT', 'XRP Ledger', 'startup investing'],
  authors: [{ name: 'Lapis' }],
  creator: 'Lapis',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Lapis',
    title: 'Lapis — AI-Powered Startup Valuations on XRPL',
    description: 'AI agent that analyzes startups, runs prediction markets, and settles equity on the XRP Ledger.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Lapis — AI-Powered Startup Valuations on XRPL',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lapis — AI-Powered Startup Valuations on XRPL',
    description: 'AI agent that analyzes startups, runs prediction markets, and settles equity on the XRP Ledger.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-dark-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

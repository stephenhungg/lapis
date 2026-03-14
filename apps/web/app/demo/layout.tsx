import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Demo',
  description: 'See Lapis in action — analyze a repo, run a prediction market, and settle equity on the XRP Ledger end-to-end.',
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portfolio',
  description: 'View your XRPL equity tokens, vesting escrows, and settlement history in one place.',
}

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children
}

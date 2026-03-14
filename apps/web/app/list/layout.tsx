import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'List a Startup',
  description: 'Submit your GitHub repository for AI-powered analysis and open a prediction market for crowd-consensus valuation.',
}

export default function ListLayout({ children }: { children: React.ReactNode }) {
  return children
}

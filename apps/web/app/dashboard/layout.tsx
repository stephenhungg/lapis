import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Analyze GitHub repositories with AI-powered scoring. Get code quality, team strength, and traction metrics in seconds.',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}

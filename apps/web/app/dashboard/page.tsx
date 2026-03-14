"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";

export default function DashboardPage() {
  const [githubUrl, setGithubUrl] = useState("");
  const router = useRouter();

  function handleAnalyze() {
    if (!githubUrl.trim()) return;
    router.push(`/list?github=${encodeURIComponent(githubUrl)}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <div className="max-w-7xl mx-auto px-6 pt-36 pb-10">
        <p className="text-sm text-muted-foreground mb-4">Paste a public GitHub URL to analyze your startup and open a prediction market.</p>
        <div className="flex gap-0 max-w-xl border border-foreground/20 overflow-hidden focus-within:border-foreground/50 transition-colors">
          <input
            className="flex-1 bg-background px-4 py-2.5 text-sm focus:outline-none placeholder-muted-foreground"
            placeholder="https://github.com/your-org/your-repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <button
            onClick={handleAnalyze}
            className="px-5 py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors flex items-center gap-2 shrink-0"
          >
            Analyze <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { AnimatedSphere } from "@/components/landing/animated-sphere";
import { STARTUPS } from "@/lib/mock-data";

export default function DashboardPage() {
  const [githubUrl, setGithubUrl] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  function handleAnalyze() {
    if (!githubUrl.trim()) return;
    const normalized = githubUrl.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const match = STARTUPS.find((s) =>
      s.github.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") === normalized
    );
    router.push(match ? `/market/${match.id}` : `/list?github=${encodeURIComponent(githubUrl)}`);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <DashboardNav />

      {/* Animated sphere background */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] lg:w-[700px] lg:h-[700px] opacity-20 pointer-events-none">
        <AnimatedSphere />
      </div>

      {/* Subtle background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        {[...Array(10)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-foreground"
            style={{ top: `${10 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center px-6">
        <div className="max-w-7xl mx-auto w-full">
          {/* Headline */}
          <h1
            className={`text-3xl font-display tracking-tight mb-2 transition-all duration-500 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Start a round
          </h1>

          <p
            className={`text-muted-foreground mb-8 text-sm max-w-xl transition-all duration-500 delay-75 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Paste a public GitHub URL to analyze any startup and open a prediction market.
          </p>

          {/* Input section */}
          <div
            className={`transition-all duration-500 delay-150 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="flex gap-0 max-w-xl border border-foreground/20 overflow-hidden focus-within:border-foreground/50 transition-all duration-300 hover:border-foreground/30 bg-background/80 backdrop-blur-sm">
              <input
                className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none placeholder-muted-foreground"
                placeholder="https://github.com/any-startup/any-repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
              <button
                onClick={handleAnalyze}
                className="px-6 py-3 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all duration-300 flex items-center gap-2 shrink-0 group"
              >
                Analyze <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-3 font-mono">
              Try: github.com/vercel/next.js or any public repo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

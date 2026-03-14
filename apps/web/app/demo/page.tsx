"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

type Step = "input" | "analyzing" | "report" | "market" | "issuing" | "complete"

const SCORES = [
  { label: "Code Quality", score: 87, detail: "Well-structured codebase, 94% test coverage" },
  { label: "Team Strength", score: 74, detail: "3 engineers, 1 repeat founder, active commits" },
  { label: "Traction", score: 91, detail: "3.2K GitHub stars, 800 weekly active users" },
  { label: "Revenue", score: 78, detail: "$12K MRR, 18% month-over-month growth" },
]

const SUMMARY =
  "Strong technical execution with clear early traction. Repeat founder with relevant domain experience. Revenue stage is early but trajectory is healthy. Market risk is the primary concern for this round."

const STEP_LABELS = ["Analyze", "Report Card", "Market", "Equity"] as const

function fmt(n: number) {
  return `$${(n / 1_000_000).toFixed(1)}M`
}

function ScoreBar({ score, animate }: { score: number; animate: boolean }) {
  return (
    <div className="flex-1 bg-gray-100 h-1.5 overflow-hidden">
      <motion.div
        className="h-full bg-blue-600"
        initial={{ width: 0 }}
        animate={{ width: animate ? `${score}%` : 0 }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
      />
    </div>
  )
}

export default function DemoPage() {
  const [step, setStep] = useState<Step>("input")
  const [url, setUrl] = useState("")
  const [repoName, setRepoName] = useState("")
  const [analysisStep, setAnalysisStep] = useState(0)
  const [marketValue, setMarketValue] = useState(7_200_000)
  const [userBet, setUserBet] = useState(8_000_000)
  const [mptAddress] = useState("rXRPL4F9A2C1D3B5E6...")

  useEffect(() => {
    if (step !== "analyzing") return
    let i = 0
    const interval = setInterval(() => {
      i++
      setAnalysisStep(i)
      if (i >= SCORES.length) {
        clearInterval(interval)
        setTimeout(() => setStep("report"), 700)
      }
    }, 750)
    return () => clearInterval(interval)
  }, [step])

  useEffect(() => {
    if (step !== "market") return
    const interval = setInterval(() => {
      setMarketValue((v) => {
        const delta = (Math.random() - 0.38) * 120_000
        return Math.min(14_000_000, Math.max(4_000_000, Math.round((v + delta) / 100_000) * 100_000))
      })
    }, 700)
    return () => clearInterval(interval)
  }, [step])

  const currentStepIndex =
    step === "input" || step === "analyzing" ? 0 : step === "report" ? 1 : step === "market" ? 2 : 3

  function handleAnalyze() {
    if (!url.trim()) return
    const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
    setRepoName(match ? match[1] : url.replace(/https?:\/\//, ""))
    setAnalysisStep(0)
    setStep("analyzing")
  }

  function handleIssue() {
    setStep("issuing")
    setTimeout(() => setStep("complete"), 2200)
  }

  function handleReset() {
    setStep("input")
    setUrl("")
    setAnalysisStep(0)
    setMarketValue(7_200_000)
    setUserBet(8_000_000)
  }

  const slideVariants = {
    enter: { opacity: 0, y: 18 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -18 },
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <div className="border-b border-gray-100 h-14 flex items-center px-6 sticky top-0 bg-white/95 backdrop-blur z-10">
        <Link href="/" className="text-sm font-bold text-gray-950 hover:text-blue-600 transition-colors">
          PublicRound
        </Link>
        <span className="mx-2.5 text-gray-300">/</span>
        <span className="text-sm text-gray-500">Live Demo</span>
      </div>

      <div className="max-w-lg mx-auto px-6 pt-12 pb-20">
        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5 mb-14">
          {STEP_LABELS.map((label, i) => {
            const done = i < currentStepIndex
            const active = i === currentStepIndex
            return (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all duration-300 ${
                    done
                      ? "bg-blue-600 text-white"
                      : active
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "text-gray-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 transition-colors ${
                      done ? "bg-white" : active ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  />
                  {label}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <span className="text-gray-200 text-xs select-none">—</span>
                )}
              </div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* INPUT */}
          {step === "input" && (
            <motion.div
              key="input"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <h1 className="text-2xl font-bold text-gray-950 mb-2">Paste a GitHub URL</h1>
              <p className="text-gray-500 text-sm mb-8">
                The AI agent analyzes the repo in real time and generates a public report
                card. Anyone can access it for $0.05.
              </p>
              <div className="flex gap-3 mb-4">
                <input
                  className="flex-1 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-3 focus:ring-blue-50 transition placeholder-gray-400"
                  placeholder="https://github.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  autoFocus
                />
                <button
                  onClick={handleAnalyze}
                  className="px-5 py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Analyze →
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Try: <span className="font-mono">github.com/vercel/next.js</span> or any public repo
              </p>
            </motion.div>
          )}

          {/* ANALYZING */}
          {step === "analyzing" && (
            <motion.div
              key="analyzing"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold text-blue-600">AI Agent Running</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-950 mb-8">
                Analyzing{" "}
                <span className="font-mono text-blue-600 text-xl break-all">{repoName}</span>
              </h1>
              <div className="space-y-5">
                {SCORES.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={i < analysisStep ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        {i < analysisStep ? (
                          <span className="text-green-500 text-sm">✓</span>
                        ) : (
                          <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-500 animate-spin inline-block" />
                        )}
                        <span className="text-sm text-gray-700">{s.label}</span>
                      </div>
                      {i < analysisStep && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm font-bold text-gray-950 tabular-nums"
                        >
                          {s.score}
                        </motion.span>
                      )}
                    </div>
                    {i < analysisStep && (
                      <p className="text-xs text-gray-400 ml-6">{s.detail}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* REPORT CARD */}
          {step === "report" && (
            <motion.div
              key="report"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1">
                  Analysis Complete
                </span>
                <span className="text-xs text-gray-400">0.05 XRP via XRPL</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-950 mb-7">Startup Report Card</h1>
              <div className="space-y-4 mb-7">
                {SCORES.map((s) => (
                  <div key={s.label} className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 w-28 flex-shrink-0">{s.label}</span>
                    <ScoreBar score={s.score} animate />
                    <span className="text-sm font-bold text-gray-950 w-8 text-right tabular-nums">
                      {s.score}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 border border-gray-100 p-5 mb-8">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  AI Summary
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">{SUMMARY}</p>
              </div>
              <button
                onClick={() => setStep("market")}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                Open Prediction Market →
              </button>
            </motion.div>
          )}

          {/* MARKET */}
          {step === "market" && (
            <motion.div
              key="market"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 bg-orange-500 animate-pulse" />
                <span className="text-xs font-semibold text-orange-600">Market Open · 142 participants</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-950 mb-10">
                What is this company worth?
              </h1>

              <div className="text-center mb-10 py-8 bg-gray-50 border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Current Consensus
                </p>
                <p className="text-5xl font-bold text-gray-950 tabular-nums transition-all duration-200">
                  {fmt(marketValue)}
                </p>
                <p className="text-xs text-gray-400 mt-2">updating live</p>
              </div>

              <div className="mb-8">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-500">Your valuation</span>
                  <span className="font-semibold text-gray-900">{fmt(userBet)}</span>
                </div>
                <input
                  type="range"
                  min={1_000_000}
                  max={20_000_000}
                  step={100_000}
                  value={userBet}
                  onChange={(e) => setUserBet(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                  <span>$1M</span>
                  <span>$20M</span>
                </div>
              </div>

              <button
                onClick={handleIssue}
                className="w-full py-3.5 bg-gray-950 text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
              >
                Settle Market & Issue Equity →
              </button>
            </motion.div>
          )}

          {/* ISSUING */}
          {step === "issuing" && (
            <motion.div
              key="issuing"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-center py-20"
            >
              <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 animate-spin mx-auto mb-5" />
              <p className="text-sm text-gray-500">Issuing MPT on XRPL testnet...</p>
              <p className="text-xs text-gray-400 mt-1.5">Deploying SAFE on Base via MetaLex</p>
            </motion.div>
          )}

          {/* COMPLETE */}
          {step === "complete" && (
            <motion.div
              key="complete"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="mb-6">
                <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1">
                  Round Complete
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-950 mb-8">Equity Issued</h1>

              <div className="mb-8 border border-gray-100 overflow-hidden">
                {[
                  { label: "Valuation Cap", value: fmt(marketValue), highlight: true },
                  { label: "MPT Ticker", value: "PRND" },
                  { label: "MPT Address", value: mptAddress },
                  { label: "SAFE Status", value: "Deployed on Base" },
                  { label: "Vesting Cliff", value: "12 months" },
                  { label: "Transfer Royalty", value: "2% per trade" },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between px-5 py-3.5 ${
                      i < 5 ? "border-b border-gray-100" : ""
                    } ${item.highlight ? "bg-blue-50" : ""}`}
                  >
                    <span className={`text-sm ${item.highlight ? "text-blue-700 font-semibold" : "text-gray-500"}`}>
                      {item.label}
                    </span>
                    <span className={`text-sm font-mono font-semibold ${item.highlight ? "text-blue-700" : "text-gray-950"}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-green-50 border border-green-100 p-5 mb-6">
                <p className="text-sm text-green-700 leading-relaxed">
                  Token holders can now convert to real equity. Vesting is enforced
                  on-chain. The SAFE is legally binding.
                </p>
              </div>

              <button
                onClick={handleReset}
                className="w-full py-3.5 border border-gray-200 text-gray-600 font-medium text-sm hover:border-gray-400 hover:text-gray-900 transition-colors"
              >
                Start another round
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

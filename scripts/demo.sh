#!/bin/bash
# Lapis Demo Script
# Usage: ./scripts/demo.sh [github_url]

API="http://localhost:3001"
REPO_URL="${1:-https://github.com/vercel/next.js}"

echo "============================================"
echo "  Lapis AI Agent Demo"
echo "============================================"
echo ""
echo "Analyzing: $REPO_URL"
echo ""

# submit for analysis
RESPONSE=$(curl -s -X POST "$API/analyze" \
  -H "Content-Type: application/json" \
  -d "{\"githubUrl\":\"$REPO_URL\"}")

ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -z "$ID" ]; then
  echo "ERROR: Failed to submit analysis"
  echo "$RESPONSE"
  exit 1
fi

echo "Report ID: $ID"
echo ""

# poll until complete
while true; do
  SCORE_RESPONSE=$(curl -s "$API/report/$ID/score")
  STATUS=$(echo "$SCORE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)

  case "$STATUS" in
    "pending")
      echo "  [.] Queued..."
      ;;
    "scraping")
      echo "  [..] Scraping GitHub data..."
      ;;
    "analyzing")
      echo "  [...] AI analyzing startup..."
      ;;
    "complete")
      echo "  [OK] Analysis complete!"
      echo ""
      break
      ;;
    "error")
      ERROR=$(echo "$SCORE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['error'])" 2>/dev/null)
      echo "  [FAIL] $ERROR"
      exit 1
      ;;
  esac

  sleep 2
done

# fetch full report (may be behind XRPL paywall — fall back to score endpoint)
REPORT=$(curl -s "$API/report/$ID")
IS_PAYWALLED=$(echo "$REPORT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'paymentDetails' in d else 'no')" 2>/dev/null)

if [ "$IS_PAYWALLED" = "yes" ]; then
  echo "  NOTE: Full report is behind XRPL paywall (send 0.05 XRP to access)"
  echo "  Using score endpoint for display..."
  echo ""
  REPORT=$(curl -s "$API/report/$ID/score")
  # reshape score response to look like full report for display
  REPORT=$(echo "$REPORT" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']
print(json.dumps({'data': {'githubUrl': '$REPO_URL', 'status': d['status'], 'scores': d['scores'], 'strengths': [], 'weaknesses': [], 'summary': '(pay 0.05 XRP for full report)', 'adversarialReport': None}}))
")
fi

echo "============================================"
echo "  STARTUP REPORT CARD"
echo "============================================"
echo ""

# extract and display scores
echo "$REPORT" | python3 -c "
import sys, json
r = json.load(sys.stdin)['data']
s = r['scores']
print(f\"  Repo:             {r['githubUrl']}\")
print(f\"  Status:           {r['status']}\")
print()
print(f\"  Code Quality:     {s['codeQuality']}/100\")
print(f\"  Team Strength:    {s['teamStrength']}/100\")
print(f\"  Traction:         {s['traction']}/100\")
print(f\"  Social Presence:  {s['socialPresence']}/100\")
print(f\"  ─────────────────────────\")
print(f\"  OVERALL:          {s['overall']}/100\")
print()
print('  Strengths:')
for x in r['strengths']:
    print(f'    + {x}')
print()
print('  Weaknesses:')
for x in r['weaknesses']:
    print(f'    - {x}')
print()
print(f\"  Summary: {r['summary']}\")

if r.get('adversarialReport'):
    ar = r['adversarialReport']
    print()
    print('  ============================================')
    print('  ADVERSARIAL AUDIT')
    print('  ============================================')
    print(f\"  Trust Score: {ar['trustScore']}/100\")
    print(f\"  Assessment: {ar['overallAssessment']}\")
    print()
    print('  Red Flags:')
    for f in ar['redFlags']:
        icon = '!!!' if f['severity'] == 'critical' else '!!' if f['severity'] == 'warning' else '!'
        print(f\"    [{icon}] {f['flag']}\")
        print(f\"         {f['reason']}\")
"

echo ""
echo "============================================"
echo "  Full report: $API/report/$ID"
echo "============================================"

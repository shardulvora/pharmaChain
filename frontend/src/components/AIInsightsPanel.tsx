import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RiskScore } from "../lib/riskScore";
import { generateAIInsights, type AIInsightsResult } from "../lib/aiInsights";

/* ── Props ─────────────────────────────────────────────────── */

interface Props {
  riskScore: RiskScore | null;
  status: string;
  scanCount: number;
  expectedUnits: number;
  alertReason: "VELOCITY_EXCEEDED" | "LOCATION_ANOMALY" | null;
  drugName: string;
  manufacturer: string;
  hasExpiry: boolean;
  city?: string;
}

/* ── Animated arc gauge (SVG) ──────────────────────────────── */

function ArcGauge({
  value,
  label,
  color,
  delay = 0,
}: {
  value: number;
  label: string;
  color: string;
  delay?: number;
}) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    setAnimatedValue(0);
    const t = window.setTimeout(() => setAnimatedValue(value), 60 + delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);

  const radius = 40;
  const circumference = Math.PI * radius; // half-circle
  const offset = circumference - (animatedValue / 100) * circumference;

  return (
    <div className="ai-gauge">
      <svg viewBox="0 0 100 58" className="ai-gauge-svg">
        <path
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <text x="50" y="46" textAnchor="middle" className="ai-gauge-value">
          {animatedValue}
        </text>
      </svg>
      <p className="ai-gauge-label">{label}</p>
    </div>
  );
}

/* ── Mini ring (for counterfeit probability) ───────────────── */

function MiniRing({
  value,
  color,
  size = 56,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    setAnimatedValue(0);
    const t = window.setTimeout(() => setAnimatedValue(value), 100);
    return () => window.clearTimeout(t);
  }, [value]);

  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (animatedValue / 100) * circ;

  return (
    <svg width={size} height={size} className="ai-mini-ring">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${offset}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" className="ai-ring-value">
        {animatedValue}%
      </text>
    </svg>
  );
}

/* ── Severity helpers ──────────────────────────────────────── */

function severityIcon(severity: string): string {
  switch (severity) {
    case "success": return "✅";
    case "warning": return "⚠️";
    case "danger": return "🚨";
    default: return "ℹ️";
  }
}

/* ── Component ─────────────────────────────────────────────── */

export default function AIInsightsPanel({
  riskScore,
  status,
  scanCount,
  expectedUnits,
  alertReason,
  drugName,
  manufacturer,
  hasExpiry,
  city,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const data: AIInsightsResult | null = useMemo(() => {
    if (!riskScore) return null;

    return generateAIInsights(
      riskScore,
      status,
      scanCount,
      expectedUnits,
      alertReason,
      drugName,
      manufacturer,
      hasExpiry,
      city
    );
  }, [riskScore, status, scanCount, expectedUnits, alertReason, drugName, manufacturer, hasExpiry, city]);

  if (!riskScore || !data) return null;

  /* ── Color helpers ───────────────────────────────────────── */

  const riskColor =
    riskScore.level === "Low"
      ? "#22c55e"
      : riskScore.level === "Medium"
        ? "#eab308"
        : "#ef4444";

  const cfColor =
    data.counterfeit.probability < 15
      ? "#22c55e"
      : data.counterfeit.probability < 40
        ? "#eab308"
        : "#ef4444";

  const trendColor =
    data.pattern.trend === "stable"
      ? "#22c55e"
      : data.pattern.trend === "rising"
        ? "#eab308"
        : "#ef4444";

  const overallColor =
    data.supplyChain.overall >= 70
      ? "#22c55e"
      : data.supplyChain.overall >= 40
        ? "#eab308"
        : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="ai-insights-panel"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-header-icon">🧠</span>
          <div>
            <h3 className="ai-header-title">AI Insights</h3>
            <p className="ai-header-sub">
              {data.verifiedChecks}/{data.totalChecks} checks passed · Model confidence {data.modelConfidence}%
            </p>
          </div>
        </div>
        <div className="ai-header-right">
          <span
            className="ai-risk-pill"
            style={{
              background: `${riskColor}18`,
              borderColor: `${riskColor}55`,
              color: riskColor,
            }}
          >
            {riskScore.level} Risk · {riskScore.score}/100
          </span>
        </div>
      </div>

      {/* ── Risk Confidence Bar ────────────────────────────── */}
      <div className="ai-confidence-section">
        <div className="ai-confidence-bar-track">
          <motion.div
            className="ai-confidence-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${riskScore.score}%` }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{ background: riskColor }}
          />
        </div>
        <div className="ai-confidence-labels">
          <span>Low Risk</span>
          <span>Medium</span>
          <span>High Risk</span>
        </div>
      </div>

      {/* ── Supply Chain Gauges ────────────────────────────── */}
      <div className="ai-section">
        <p className="ai-section-label">Supply Chain Integrity</p>
        <div className="ai-gauges-grid">
          <ArcGauge value={data.supplyChain.integrity} label="Integrity" color="#4f7dff" delay={0} />
          <ArcGauge value={data.supplyChain.transparency} label="Transparency" color="#4eb7ff" delay={80} />
          <ArcGauge value={data.supplyChain.compliance} label="Compliance" color="#a78bfa" delay={160} />
          <ArcGauge value={data.supplyChain.overall} label="Overall" color={overallColor} delay={240} />
        </div>
      </div>

      {/* ── Counterfeit + Pattern Row ─────────────────────── */}
      <div className="ai-twin-row">
        <div className="ai-twin-card">
          <p className="ai-section-label">Counterfeit Probability</p>
          <div className="ai-twin-card-body">
            <MiniRing value={data.counterfeit.probability} color={cfColor} size={64} />
            <div>
              <p className="ai-twin-value" style={{ color: cfColor }}>
                {data.counterfeit.label}
              </p>
              <ul className="ai-factor-list">
                {data.counterfeit.factors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="ai-twin-card">
          <p className="ai-section-label">Pattern Analysis</p>
          <div className="ai-pattern-body">
            <span
              className="ai-trend-badge"
              style={{
                background: `${trendColor}18`,
                borderColor: `${trendColor}55`,
                color: trendColor,
              }}
            >
              {data.pattern.trend === "stable" ? "● Stable" : data.pattern.trend === "rising" ? "▲ Rising" : "▲▲ Critical"}
            </span>
            <p className="ai-pattern-title">{data.pattern.label}</p>
            <p className="ai-pattern-desc">{data.pattern.description}</p>
          </div>
        </div>
      </div>

      {/* ── Verification Checks (expandable) ──────────────── */}
      <div className="ai-checks-section">
        <button
          type="button"
          className="ai-expand-btn"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span>{expanded ? "Hide" : "Show"} verification checks ({data.verifiedChecks}/{data.totalChecks} passed)</span>
          <span className="ai-expand-chevron" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="ai-checks-list-wrap"
            >
              <div className="ai-checks-list">
                {data.insights.map((insight) => (
                  <motion.div
                    key={insight.id}
                    className={`ai-check-item ai-check-${insight.severity}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <span className="ai-check-icon">{severityIcon(insight.severity)}</span>
                    <div>
                      <p className="ai-check-title">{insight.title}</p>
                      <p className="ai-check-detail">{insight.detail}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Recommendation Footer ─────────────────────────── */}
      <div className="ai-recommendation">
        <span className="ai-rec-icon">💡</span>
        <div>
          <p className="ai-rec-label">AI Recommendation</p>
          <p className="ai-rec-text">{riskScore.recommendation}</p>
        </div>
      </div>
    </motion.div>
  );
}

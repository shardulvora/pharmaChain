import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { NarrativeResponse } from "../lib/api";

interface Props {
  narrative: NarrativeResponse | null;
  isLoading: boolean;
}

export default function AIInsightsPanel({ narrative, isLoading }: Props) {
  if (!narrative && !isLoading) return null;

  /* ── Color helpers ───────────────────────────────────────── */
  const riskColor =
    narrative?.riskLevel === "Low"
      ? "#22c55e"
      : narrative?.riskLevel === "Medium"
        ? "#eab308"
        : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="ai-insights-panel"
      style={{
        background: "rgba(13,17,23,0.7)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 24,
        marginTop: 24,
        overflow: "hidden",
        position: "relative"
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: "1.8rem", textShadow: "0 0 20px rgba(0,245,212,0.4)" }}>🧠</span>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>AI Risk Assessment</h3>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              Powered by <span style={{ color: "#00f5d4", fontFamily: "monospace" }}>{narrative?.model || "Groq LLM"}</span>
            </p>
          </div>
        </div>
        {!isLoading && narrative && (
          <span
            style={{
              background: `${riskColor}18`,
              border: `1px solid ${riskColor}55`,
              color: riskColor,
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}
          >
            {narrative.riskLevel} Risk
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ padding: "10px 0" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                style={{ width: 16, height: 16, border: "2px solid rgba(0,245,212,0.3)", borderTopColor: "#00f5d4", borderRadius: "50%" }}
              />
              <span style={{ fontSize: "0.85rem", color: "#00f5d4", fontWeight: 500 }}>Model analyzing supply chain data...</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, width: "100%" }} />
              <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, width: "85%" }} />
              <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, width: "60%" }} />
            </div>
          </motion.div>
        ) : narrative ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* ── Risk Confidence Bar ────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>Model Confidence</span>
                <span style={{ color: riskColor, fontWeight: 700 }}>{narrative.confidence}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${narrative.confidence}%` }}
                  transition={{ duration: 1, delay: 0.1, ease: "easeOut" }}
                  style={{ height: "100%", background: riskColor, borderRadius: 99 }}
                />
              </div>
            </div>

            {/* ── Narrative ──────────────────────────────────────── */}
            <div style={{ 
              background: "rgba(255,255,255,0.02)", 
              border: "1px solid rgba(255,255,255,0.05)",
              padding: 16, 
              borderRadius: 12,
              marginBottom: 20
            }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.6 }}>
                {narrative.narrative}
              </p>
            </div>

            {/* ── Key Findings ───────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px 0", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Key Findings</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {narrative.keyFindings.map((finding, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                  >
                    <span style={{ color: riskColor, fontSize: "1rem", lineHeight: 1 }}>
                      {narrative.riskLevel === "Low" ? "✓" : narrative.riskLevel === "Medium" ? "⚠" : "✗"}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>{finding}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Recommendation ─────────────────────────────────── */}
            <div style={{ 
              background: `${riskColor}10`,
              borderLeft: `4px solid ${riskColor}`,
              padding: "14px 16px",
              borderRadius: "0 8px 8px 0"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: "1rem" }}>💡</span>
                <span style={{ fontSize: "0.75rem", color: riskColor, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Recommendation</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.5 }}>
                {narrative.recommendation}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

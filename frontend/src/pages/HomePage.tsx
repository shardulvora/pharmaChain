import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getStats, type StatsResponse } from "../lib/api";

const features = [
  {
    icon: "🔗",
    title: "On-Chain Provenance",
    desc: "Every batch is immutably registered on Ethereum. Blockchain records cannot be altered, forged, or deleted.",
  },
  {
    icon: "🧠",
    title: "AI Risk Insights",
    desc: "Our AI engine analyses scan velocity, geolocation patterns, and supply-chain gaps to surface counterfeit signals instantly.",
  },
  {
    icon: "🌍",
    title: "Geo Anomaly Detection",
    desc: "Real-time detection of physically impossible distribution patterns — catch QR duplication attacks before harm is done.",
  },
  {
    icon: "🔒",
    title: "Full Chain-of-Custody",
    desc: "Track a drug from Manufacturer → Distributor → Logistics → Pharmacy, with every handoff timestamped on-chain.",
  },
  {
    icon: "📊",
    title: "Supply Chain Dashboard",
    desc: "Monitor all registered batches, authentic vs recalled counts, and flag suspicious activity in real time.",
  },
  {
    icon: "📱",
    title: "QR Code Verification",
    desc: "Scan a package QR with any camera. No app install required — verification happens in your browser in seconds.",
  },
];

const statLabels: Record<string, string> = {
  totalBatches: "Batches Registered",
  authenticCount: "Authentic",
  expiredCount: "Expired",
  revokedCount: "Recalled",
};

export default function HomePage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {/* Non-critical — hide stats strip silently */});
  }, []);

  return (
    <div className="home-page">

      {/* ── Hero ────────────────────────────────────────────── */}
      <motion.section
        className="hero-section"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-glow" />

        <p className="hero-eyebrow">Blockchain-Powered · AI-Enhanced</p>

        <h1 className="hero-title">
          Stop Counterfeit Drugs<br />
          <span className="hero-title-accent">Before They Reach Patients</span>
        </h1>

        <p className="hero-subtitle">
          PillChain verifies pharmaceutical authenticity in seconds using on-chain
          provenance records and AI-driven risk analysis. Scan a QR code, get the truth.
        </p>

        <div className="hero-actions">
          <Link to="/verify" className="hero-cta-primary">
            🔍 Verify a Drug Now
          </Link>
          <Link to="/dashboard" className="hero-cta-secondary">
            📊 View Dashboard
          </Link>
        </div>
      </motion.section>

      {/* ── Live Stats Strip ─────────────────────────────────── */}
      {stats && (
        <motion.div
          className="stats-strip"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          {(
            [
              ["totalBatches", stats.totalBatches],
              ["authenticCount", stats.authenticCount],
              ["expiredCount", stats.expiredCount],
              ["revokedCount", stats.revokedCount],
            ] as [string, number][]
          ).map(([key, value]) => (
            <div key={key} className="stats-strip-item">
              <span className="stats-strip-value">{value.toLocaleString()}</span>
              <span className="stats-strip-label">{statLabels[key]}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Feature Grid ─────────────────────────────────────── */}
      <motion.section
        className="features-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <p className="features-eyebrow">Why PillChain</p>
        <h2 className="features-heading">Built for trust. Designed for speed.</h2>

        <div className="features-grid">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i + 0.4 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <motion.section
        className="home-cta-section"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.65 }}
      >
        <div className="home-cta-card">
          <div className="home-cta-glow" />
          <p className="hero-eyebrow">Ready to verify?</p>
          <h2 className="home-cta-heading">
            One batch ID. Instant blockchain proof.
          </h2>
          <p className="home-cta-sub">
            Scan a QR code or enter a batch ID to verify authenticity, check recall
            status, and get a full AI risk assessment — in under 5 seconds.
          </p>
          <Link to="/verify" className="hero-cta-primary" style={{ display: "inline-flex" }}>
            🔍 Open Verification Vault →
          </Link>
        </div>
      </motion.section>

    </div>
  );
}

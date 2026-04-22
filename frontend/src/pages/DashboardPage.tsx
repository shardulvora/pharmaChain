import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAllBatches, getStats, type BatchData, type StatsResponse } from "../lib/api";
import StatsCard from "../components/StatsCard";
import BatchTable from "../components/BatchTable";

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [statsData, batchData] = await Promise.all([
          getStats(),
          getAllBatches(),
        ]);
        setStats(statsData);
        setBatches(batchData.batches);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="home-hero" style={{ textAlign: "left", padding: "32px 0 24px" }}>
          <p className="section-eyebrow">Overview</p>
          <h1 className="section-title">Dashboard</h1>
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%", margin: "0 auto 8px" }} />
              <div className="skeleton" style={{ width: 60, height: 32, margin: "0 auto 8px" }} />
              <div className="skeleton" style={{ width: 80, height: 14, margin: "0 auto" }} />
            </div>
          ))}
        </div>
        <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="home-hero" style={{ textAlign: "left", padding: "32px 0 24px" }}>
          <p className="section-eyebrow">Overview</p>
          <h1 className="section-title">Dashboard</h1>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        style={{ textAlign: "left", padding: "32px 0 24px" }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="section-eyebrow">Overview</p>
        <h1 className="section-title">Dashboard</h1>
        <p className="section-subtitle">
          Real-time overview of all drug batches registered on the blockchain.
        </p>
      </motion.div>

      <div className="stats-grid">
        <StatsCard icon="📦" value={stats?.totalBatches ?? 0} label="Total Batches" />
        <StatsCard icon="✅" value={stats?.authenticCount ?? 0} label="Authentic" />
        <StatsCard icon="⏱️" value={stats?.expiredCount ?? 0} label="Expired" />
        <StatsCard icon="🚨" value={stats?.revokedCount ?? 0} label="Recalled" />
      </div>

      <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: 18 }}>Registered Batches</h2>
        <BatchTable batches={batches} />
      </motion.div>
    </div>
  );
}

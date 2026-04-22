import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { verifyBatch, type VerifyResponse } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");

    verifyBatch(decodeURIComponent(id))
      .then(setResult)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Verification failed")
      )
      .finally(() => setLoading(false));
  }, [id]);

  const statusIcon: Record<string, string> = {
    AUTHENTIC: "✅",
    EXPIRED: "⏱️",
    RECALLED: "🚨",
    FAKE: "❌",
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 0" }}>
        <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 12 }} />
        <div className="skeleton" style={{ width: 280, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px 0" }}>
        <Link to="/" style={{ fontSize: "0.875rem" }}>← Back to verification</Link>
        <div className="error-message" style={{ marginTop: 16 }}>{error}</div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <motion.div
      style={{ padding: "32px 0" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Link to="/" style={{ fontSize: "0.875rem", display: "inline-block", marginBottom: 20 }}>
        ← Back to verification
      </Link>

      <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="verify-result-header">
          <div className={`verify-result-icon ${result.status.toLowerCase()}`}>
            {statusIcon[result.status] ?? "❓"}
          </div>
          <div>
            <StatusBadge status={result.status} />
            <p className="verify-result-message" style={{ marginTop: 6 }}>
              {result.message}
            </p>
          </div>
        </div>

        <div className="verify-result-details">
          <div className="detail-item">
            <div className="detail-label">Batch ID</div>
            <div className="detail-value">{result.data.batchId || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Drug Name</div>
            <div className="detail-value">{result.data.drugName || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Manufacturer</div>
            <div className="detail-value">{result.data.manufacturer || "—"}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Expiry Date</div>
            <div className="detail-value">
              {result.data.expiryDate
                ? new Date(result.data.expiryDate * 1000).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Registered By</div>
            <div className="detail-value" style={{ fontSize: "0.75rem" }}>
              {result.data.registeredBy || "—"}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Revoked</div>
            <div className="detail-value">
              {result.data.isRevoked ? "⚠️ Yes — Recalled" : "No"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, padding: "16px", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
          <div className="detail-label" style={{ marginBottom: 6 }}>Shareable Link</div>
          <div className="detail-value" style={{ fontSize: "0.8125rem", wordBreak: "break-all", color: "var(--text-accent)" }}>
            {window.location.href}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

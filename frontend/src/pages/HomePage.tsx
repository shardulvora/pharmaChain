import { FormEvent, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { verifyBatch, type VerifyResponse } from "../lib/api";
import { addToHistory, getHistory, clearHistory, formatTimeAgo, type HistoryEntry } from "../lib/history";
import StatusBadge from "../components/StatusBadge";
import QRScanner from "../components/QRScanner";

export default function HomePage() {
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(getHistory);

  const doVerify = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await verifyBatch(id.trim());
      setResult(data);

      addToHistory({
        batchId: data.data.batchId || id.trim(),
        drugName: data.data.drugName || "Unknown",
        status: data.status,
      });
      setHistory(getHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify batch");
    } finally {
      setLoading(false);
    }
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    doVerify(batchId);
  }

  function onScan(scannedValue: string) {
    setBatchId(scannedValue);
    doVerify(scannedValue);
  }

  function onHistoryClear() {
    clearHistory();
    setHistory([]);
  }

  function onHistoryClick(entry: HistoryEntry) {
    setBatchId(entry.batchId);
    doVerify(entry.batchId);
  }

  const statusIcon: Record<string, string> = {
    AUTHENTIC: "✅",
    EXPIRED: "⏱️",
    RECALLED: "🚨",
    FAKE: "❌",
  };

  return (
    <>
      <div className="home-hero">
        <p className="section-eyebrow">Blockchain-Verified</p>
        <h1 className="section-title">Drug Batch Verification</h1>
        <p className="section-subtitle">
          Enter a batch ID or scan the QR code on your medicine to verify its authenticity
          against the blockchain.
        </p>
      </div>

      <div className="verify-form-wrapper">
        <form className="verify-form" onSubmit={onSubmit}>
          <input
            id="batch-input"
            className="input"
            placeholder="e.g. BATCH001"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            autoComplete="off"
          />
          <button
            id="verify-btn"
            className="btn btn-primary"
            type="submit"
            disabled={loading || !batchId.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" /> Verifying…
              </>
            ) : (
              "🔍 Verify"
            )}
          </button>
          <button
            id="scan-btn"
            className="btn btn-secondary scan-btn"
            type="button"
            onClick={() => setScannerOpen(true)}
          >
            📷 Scan
          </button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && (
            <motion.div
              className="verify-result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="verify-result-header">
                <div className={`verify-result-icon ${result.status.toLowerCase()}`}>
                  {statusIcon[result.status] ?? "❓"}
                </div>
                <div>
                  <StatusBadge status={result.status} />
                  <p className="verify-result-message">{result.message}</p>
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
                      ? new Date(result.data.expiryDate * 1000).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "long", day: "numeric" }
                        )
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
                  <div className="detail-label">On-Chain Status</div>
                  <div className="detail-value">
                    {result.data.exists ? "✓ Registered" : "✗ Not Found"}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification History */}
        {history.length > 0 && (
          <div className="history-section">
            <h3>
              🕓 Recent Verifications
              <button className="history-clear-btn" onClick={onHistoryClear}>
                Clear
              </button>
            </h3>
            <div className="history-list">
              {history.map((entry) => (
                <div
                  key={entry.batchId + entry.timestamp}
                  className="history-item"
                  onClick={() => onHistoryClick(entry)}
                >
                  <div className="history-item-left">
                    <span>{statusIcon[entry.status] ?? "❓"}</span>
                    <span className="history-batch-id">{entry.batchId}</span>
                    <span className="history-drug-name">{entry.drugName}</span>
                  </div>
                  <span className="history-time">{formatTimeAgo(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={onScan} />
    </>
  );
}

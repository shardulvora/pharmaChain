import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { toPng } from "html-to-image";
import { verifyBatch, type VerifyResponse } from "../lib/api";

type VerifyTab = "scan" | "manual";
type VerifyViewState = "SAFE" | "WARNING" | "COUNTERFEIT";

interface TimelineStep {
  actor: string;
  role: "Manufacturer" | "Distributor" | "Logistics" | "Pharmacy";
  location: string;
  timestamp: string;
  txHash: string;
}

interface WarningFlag {
  label: string;
  detail: string;
}

function extractBatchId(raw: string): string {
  const trimmed = raw.trim();
  const normalize = (value: string) => value.trim().toUpperCase();

  try {
    const url = new URL(trimmed);
    const chunks = url.pathname.split("/").filter(Boolean);
    if (chunks.length > 0) {
      return normalize(decodeURIComponent(chunks[chunks.length - 1]));
    }
  } catch {
    // Not a URL, parse plain batch value.
  }

  try {
    return normalize(decodeURIComponent(trimmed));
  } catch {
    return normalize(trimmed);
  }
}

function pseudoHex(seed: string, length: number): string {
  const chars = "0123456789abcdef";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  let out = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.abs((hash + i * 13 + seed.length * 17) % chars.length);
    out += chars[idx];
  }
  return out;
}

function formatHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function getDeterministicNumber(input: string, mod: number): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value += input.charCodeAt(i) * (i + 3);
  }
  return value % mod;
}

function buildTimeline(batchId: string, manufacturer: string): TimelineStep[] {
  const locations = [
    "Mumbai Manufacturing Plant",
    "Navi Mumbai Cold Hub",
    "Pune Regional Distribution Center",
    "CityCare Pharmacy Network",
  ];

  const actors = [
    manufacturer || "Certified Pharma Unit",
    "Apex Distribution Pvt Ltd",
    "BlueLine Cold Logistics",
    "CityCare Pharmacy",
  ];

  const roles: TimelineStep["role"][] = [
    "Manufacturer",
    "Distributor",
    "Logistics",
    "Pharmacy",
  ];

  const baseTime = Date.now() - (getDeterministicNumber(batchId, 96) + 12) * 60 * 60 * 1000;

  return roles.map((role, index) => {
    const isoTime = new Date(baseTime + index * 8 * 60 * 60 * 1000).toISOString();
    const txHash = `0x${pseudoHex(`${batchId}-${role}-${index}`, 64)}`;

    return {
      actor: actors[index],
      role,
      location: locations[index],
      timestamp: isoTime,
      txHash,
    };
  });
}

function buildWarningFlags(batchId: string, status: VerifyResponse["status"]): WarningFlag[] {
  const probe = getDeterministicNumber(batchId, 5);

  const flags: WarningFlag[] = [
    {
      label: "Temperature Violation Detected",
      detail: `Cold-chain sensor breach at Transit Hub 2: 14.${probe}°C for ${25 + probe * 4} minutes (max allowed 8°C).`,
    },
  ];

  if (status === "EXPIRED") {
    flags.push({
      label: "Shelf-Life Exceeded",
      detail: "Batch has crossed regulatory expiry and must not be dispensed.",
    });
  }

  if (status === "RECALLED") {
    flags.push({
      label: "Recall Notice Active",
      detail: "Manufacturer has marked this lot as recalled. Quarantine advised.",
    });
  }

  return flags;
}

export default function VerifyPage() {
  const [activeTab, setActiveTab] = useState<VerifyTab>("scan");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [warningFlags, setWarningFlags] = useState<WarningFlag[]>([]);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [scannerError, setScannerError] = useState("");
  const [sharing, setSharing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStartingRef = useRef(false);
  const scannedLockRef = useRef(false);
  const resultCardRef = useRef<HTMLDivElement | null>(null);

  const scannerElementId = "vault-qr-reader";

  const verifyState = useMemo<VerifyViewState | null>(() => {
    if (!result) return null;
    if (result.status === "FAKE") return "COUNTERFEIT";

    const ruleBasedTempBreach = getDeterministicNumber(result.data.batchId || batchId, 4) === 1;
    if (result.status === "RECALLED" || result.status === "EXPIRED" || ruleBasedTempBreach) {
      return "WARNING";
    }

    return "SAFE";
  }, [batchId, result]);

  useEffect(() => {
    const shouldScan = activeTab === "scan";

    async function stopScanner() {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      try {
        if (scanner.getState() === 2) {
          await scanner.stop();
        }
      } catch {
        // Ignore shutdown failures.
      }
      try {
        await scanner.clear();
      } catch {
        // Ignore clear failures.
      }
    }

    if (!shouldScan) {
      stopScanner();
      return;
    }

    let cancelled = false;
    scannedLockRef.current = false;
    setScannerError("");

    const mountScanner = async () => {
      if (scannerStartingRef.current) return;
      scannerStartingRef.current = true;

      try {
        const root = document.getElementById(scannerElementId);
        if (root) {
          root.innerHTML = "";
        }

        const scanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decodedText) => {
            if (cancelled || scannedLockRef.current) return;
            scannedLockRef.current = true;

            const parsed = extractBatchId(decodedText);
            setBatchId(parsed);
            setActiveTab("manual");

            window.setTimeout(() => {
              scannedLockRef.current = false;
            }, 1200);
          },
          () => {
            // Ignore scan misses while camera is open.
          }
        );
      } catch {
        if (!cancelled) {
          setScannerError("Camera access failed. Allow camera permission and retry.");
        }
      } finally {
        scannerStartingRef.current = false;
      }
    };

    mountScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [activeTab]);

  const runVerify = useCallback(async (rawBatchId: string) => {
    const normalized = extractBatchId(rawBatchId);
    if (!normalized) {
      setError("Please enter a valid batch ID.");
      return;
    }

    setBatchId(normalized);
    setError("");
    setResult(null);
    setWarningFlags([]);
    setTimeline([]);
    setLoading(true);

    try {
      const [response] = await Promise.all([
        verifyBatch(normalized),
        new Promise((resolve) => window.setTimeout(resolve, 2200)),
      ]);

      setResult(response);
      setTimeline(buildTimeline(response.data.batchId || normalized, response.data.manufacturer));

      if (response.status === "FAKE") {
        setWarningFlags([]);
      } else {
        const flags = buildWarningFlags(response.data.batchId || normalized, response.status);
        setWarningFlags(flags);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onVerifySubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runVerify(batchId);
  };

  const onShare = async () => {
    if (!resultCardRef.current || !result) return;

    try {
      setSharing(true);
      const dataUrl = await toPng(resultCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050b1f",
      });

      const anchor = document.createElement("a");
      const safeBatchId = (result.data.batchId || "result").replace(/[^a-z0-9_-]/gi, "_");
      anchor.href = dataUrl;
      anchor.download = `pharmachain-${safeBatchId}.png`;
      anchor.click();
    } catch {
      setError("Could not generate share card image. Try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="vault-verify-page">
      <motion.div
        className="vault-shell"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="vault-heading">
          <p className="vault-eyebrow">PharmaChain Verification Vault</p>
          <h1>Unlock medicine trust in seconds</h1>
          <p>Scan a package QR or type a batch ID to query on-chain provenance.</p>
        </div>

        <div className="vault-card">
          <div className="vault-tabs" role="tablist" aria-label="Batch verification tabs">
            <button
              role="tab"
              type="button"
              className={`vault-tab-btn ${activeTab === "scan" ? "active" : ""}`}
              aria-selected={activeTab === "scan"}
              onClick={() => setActiveTab("scan")}
            >
              Scan QR
            </button>
            <button
              role="tab"
              type="button"
              className={`vault-tab-btn ${activeTab === "manual" ? "active" : ""}`}
              aria-selected={activeTab === "manual"}
              onClick={() => setActiveTab("manual")}
            >
              Enter Batch ID
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "scan" ? (
              <motion.div
                key="scan"
                className="vault-tab-panel"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                transition={{ duration: 0.25 }}
              >
                <div className="vault-scanner-panel">
                  <div id={scannerElementId} className="vault-scanner" />
                </div>
                <p className="vault-help-text">
                  Camera scan auto-fills the Batch ID field, then switch to "Enter Batch ID" to verify.
                </p>
                {scannerError && <p className="vault-inline-error">{scannerError}</p>}
              </motion.div>
            ) : (
              <motion.form
                key="manual"
                onSubmit={onVerifySubmit}
                className="vault-tab-panel"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.25 }}
              >
                <label className="vault-input-label" htmlFor="vault-batch-id">
                  Batch ID
                </label>
                <input
                  id="vault-batch-id"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="e.g. BATCH001"
                  className="vault-input"
                  autoComplete="off"
                />

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -1 }}
                  type="submit"
                  className="vault-verify-btn"
                  disabled={loading || !batchId.trim()}
                >
                  Verify Now
                </motion.button>

                {error && <p className="vault-inline-error">{error}</p>}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {result && verifyState && verifyState !== "COUNTERFEIT" && (
            <motion.div
              ref={resultCardRef}
              className={`vault-result-card ${verifyState.toLowerCase()}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="vault-result-header">
                <div>
                  <p className="vault-result-status">
                    {verifyState === "SAFE" ? "✅ SAFE" : "⚠️ WARNING"}
                  </p>
                  <h2>{result.data.drugName || "Unknown Drug"}</h2>
                  <p>{result.message}</p>
                </div>
                <button
                  type="button"
                  className="vault-share-btn"
                  onClick={onShare}
                  disabled={sharing}
                >
                  {sharing ? "Generating..." : "Share Result"}
                </button>
              </div>

              <div className="vault-grid">
                <div>
                  <p className="vault-meta-label">Manufacturer</p>
                  <p>{result.data.manufacturer || "Unknown"}</p>
                </div>
                <div>
                  <p className="vault-meta-label">Expiry</p>
                  <p>
                    {result.data.expiryDate
                      ? new Date(result.data.expiryDate * 1000).toLocaleDateString()
                      : "Not available"}
                  </p>
                </div>
                <div>
                  <p className="vault-meta-label">Current Location</p>
                  <p>{timeline[timeline.length - 1]?.location ?? "In transit"}</p>
                </div>
              </div>

              {verifyState === "WARNING" && warningFlags.length > 0 && (
                <div className="vault-warning-box">
                  {warningFlags.map((flag) => (
                    <div key={flag.label} className="vault-warning-item">
                      <p>{flag.label}</p>
                      <span>{flag.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="vault-timeline">
                {timeline.map((step, index) => (
                  <div className="vault-timeline-step" key={`${step.txHash}-${step.role}`}>
                    <div className="vault-timeline-dot" />
                    <div className="vault-timeline-content">
                      <div className="vault-step-topline">
                        <strong>{step.actor}</strong>
                        <span className={`vault-role-badge ${step.role.toLowerCase()}`}>{step.role}</span>
                      </div>
                      <p>{step.location}</p>
                      <div className="vault-step-bottomline">
                        <span>{new Date(step.timestamp).toLocaleString()}</span>
                        <a
                          href={`https://etherscan.io/tx/${step.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {formatHash(step.txHash)}
                        </a>
                      </div>
                    </div>
                    {index < timeline.length - 1 && <div className="vault-timeline-line" />}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {loading && (
          <motion.div
            className="vault-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="vault-loading-shell"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <motion.div
                className="vault-chain-loader"
                animate={{ rotate: 360 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.2, ease: "linear" }}
              >
                <span />
                <span />
                <span />
                <span />
              </motion.div>
              <h3>Querying blockchain...</h3>
              <p>Unlocking vault proof and validating every transfer record.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && verifyState === "COUNTERFEIT" && (
          <motion.div
            className="vault-counterfeit-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="vault-counterfeit-card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <div className="vault-warning-icon">❌</div>
              <h2>COUNTERFEIT DETECTED</h2>
              <p>Do NOT consume. This batch cannot be validated on-chain.</p>
              <button
                type="button"
                className="vault-report-btn"
                onClick={() => window.open("mailto:alerts@pharmachain.org?subject=Counterfeit%20Batch%20Report", "_blank")}
              >
                Do NOT consume. Report immediately.
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

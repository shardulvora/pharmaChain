import { useCallback, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";

export default function GeneratePage() {
  const [batchId, setBatchId] = useState("");
  const [generated, setGenerated] = useState("");
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  function onGenerate() {
    const normalizedBatchId = batchId.trim().toUpperCase();
    if (!normalizedBatchId) return;
    setGenerated(normalizedBatchId);
    setBatchId(normalizedBatchId);
  }

  const onDownload = useCallback(() => {
    const canvas = canvasWrapperRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `pillchain-${generated}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [generated]);

  return (
    <div>
      <motion.div
        style={{ textAlign: "center", padding: "48px 0 32px" }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="section-eyebrow">For Manufacturers</p>
        <h1 className="section-title">QR Code Generator</h1>
        <p className="section-subtitle">
          Generate a QR code label for an existing batch ID. This only creates a QR
          image for packaging — it does not register/seed the batch on blockchain.
        </p>
      </motion.div>

      <div className="qr-generator-wrapper">
        <div className="glass-card">
          <label
            htmlFor="generate-input"
            style={{
              display: "block",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Batch ID
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              id="generate-input"
              className="input"
              placeholder="e.g. BATCH001"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onGenerate()}
            />
            <button
              id="generate-btn"
              className="btn btn-primary"
              onClick={onGenerate}
              disabled={!batchId.trim()}
            >
              Generate
            </button>
          </div>

          <AnimatePresence>
            {generated && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.35 }}
              >
                <div className="qr-output" ref={canvasWrapperRef}>
                  <QRCodeCanvas
                    value={generated}
                    size={220}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#0a1430"
                  />
                  <span className="qr-batch-label">{generated}</span>
                </div>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={onDownload}>
                    ⬇️ Download PNG
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

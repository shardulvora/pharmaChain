import { useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (batchId: string) => void;
}

export default function QRScanner({ open, onClose, onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const isStoppingRef = useRef(false);
  const lastScannedRef = useRef("");
  const isProcessingScanRef = useRef(false);

  // Stable refs for callbacks to avoid useEffect re-runs
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      const scanner = scannerRef.current;
      if (scanner) {
        const state = scanner.getState();
        // Only stop if it's actually scanning (state 2 = SCANNING)
        if (state === 2) {
          await scanner.stop();
        }
        scannerRef.current = null;
      }
    } catch {
      // Ignore stop errors — scanner may already be stopped
    } finally {
      isStoppingRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    lastScannedRef.current = "";
    isProcessingScanRef.current = false;

    if (!open) return;

    const scannerId = "qr-reader";

    const timeout = setTimeout(async () => {
      // Bail if component already unmounted
      if (!isMountedRef.current) return;

      try {
        const container = document.getElementById(scannerId);
        if (container) {
          container.innerHTML = "";
        }

        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            const normalized = decodedText.trim();
            if (!normalized) return;

            // Avoid duplicate scans of the same QR while scanner is open.
            if (normalized === lastScannedRef.current) return;

            // Prevent request storms while verification is in-flight.
            if (isProcessingScanRef.current) return;

            lastScannedRef.current = normalized;
            isProcessingScanRef.current = true;

            try {
              onScanRef.current(normalized);
            } finally {
              window.setTimeout(() => {
                isProcessingScanRef.current = false;
              }, 700);
            }
          },
          () => {
            // No QR found in frame — ignore
          }
        );
      } catch (err) {
        console.error("QR Scanner failed to start:", err);
      }
    }, 400);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeout);
      stopScanner();
    };
  }, [open, stopScanner]);

  const handleClose = useCallback(() => {
    stopScanner().then(() => {
      onCloseRef.current();
    });
  }, [stopScanner]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="qr-scanner-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <motion.div
            className="qr-scanner-card"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <button className="qr-scanner-close" onClick={handleClose}>
              ✕
            </button>
            <h2>📷 Scan QR Code</h2>
            <p>
              Point your camera at the QR code on the medicine packaging. The scanner
              stays open so you can verify multiple batch IDs.
            </p>
            <div className="qr-reader-container">
              <div id="qr-reader" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

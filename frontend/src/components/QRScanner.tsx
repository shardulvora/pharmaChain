import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (batchId: string) => void;
}

export default function QRScanner({ open, onClose, onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const scannerId = "qr-reader";

    // Small delay to let the DOM render the container
    const timeout = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
            onClose();
          },
          () => {} // ignore scan errors (no QR in frame)
        );
      } catch (err) {
        console.error("QR Scanner failed to start:", err);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan, onClose]);

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
              onClose();
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
            <button className="qr-scanner-close" onClick={onClose}>
              ✕
            </button>
            <h2>📷 Scan QR Code</h2>
            <p>Point your camera at the QR code on the medicine packaging.</p>
            <div className="qr-reader-container" ref={containerRef}>
              <div id="qr-reader" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

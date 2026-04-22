import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface SecurityAlertProps {
  alertReason: "VELOCITY_EXCEEDED" | "LOCATION_ANOMALY" | null;
  scanCount: number;
  expectedUnits: number;
  previousScan: { city: string; scanned_at: string } | null;
  currentCity: string;
  onReport: () => void;
}

export default function SecurityAlert({
  alertReason,
  scanCount,
  expectedUnits,
  previousScan,
  currentCity,
  onReport,
}: SecurityAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (alertReason === null) return null;

  const overLimit = scanCount - expectedUnits;
  const expectedWidth =
    scanCount > 0 ? Math.max(0, Math.min(100, (expectedUnits / scanCount) * 100)) : 100;
  const excessUnits = Math.max(overLimit, 0);
  const excessWidth = scanCount > 0 ? (excessUnits / scanCount) * 100 : 0;

  const minutesSincePrevious = previousScan
    ? Math.floor((Date.now() - new Date(previousScan.scanned_at).getTime()) / 60000)
    : 0;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`relative rounded-xl p-5 mt-4 border-l-4 ${
            alertReason === "VELOCITY_EXCEEDED"
              ? "bg-amber-950/50 border border-amber-600 border-l-amber-500"
              : "bg-red-950/50 border border-red-600 border-l-red-500"
          }`}
        >
          {alertReason === "VELOCITY_EXCEEDED" ? (
            <>
              <button
                type="button"
                className="absolute top-3 right-3 text-amber-500 hover:text-amber-300"
                onClick={() => setDismissed(true)}
              >
                ✕
              </button>

              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="w-full">
                  <h3 className="font-bold text-amber-300">Unusual Scan Activity Detected</h3>
                  <p className="text-amber-200/80 mt-1">
                    This batch expected {expectedUnits} units but has been scanned {scanCount} times — {overLimit} over
                    limit.
                  </p>

                  <div className="mt-3">
                    <div className="flex rounded-full overflow-hidden h-3 bg-gray-700">
                      <div className="bg-green-500" style={{ width: `${expectedWidth}%` }} />
                      <div className="bg-red-500" style={{ width: `${Math.max(0, excessWidth)}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-amber-200/80">
                      <span>Expected ({expectedUnits})</span>
                      <span>Excess ({overLimit})</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="absolute top-3 right-3 text-red-500 hover:text-red-300"
                onClick={() => setDismissed(true)}
              >
                ✕
              </button>

              <div className="flex items-start gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <h3 className="font-bold text-red-300">Geographic Anomaly Detected</h3>
                  <p className="text-red-200/80 mt-1">
                    This batch was verified in {previousScan?.city || "an unknown location"} only {minutesSincePrevious} minutes
                    ago, but is now being scanned in {currentCity || "an unknown city"}. This is physically impossible and
                    indicates counterfeiting.
                  </p>

                  <button
                    type="button"
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold mt-3 flex items-center gap-2"
                    onClick={onReport}
                  >
                    🚩 Report incident
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

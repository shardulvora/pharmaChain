import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { BatchData } from "../lib/api";
import StatusBadge from "./StatusBadge";

interface Props {
  batches: BatchData[];
}

function getBatchStatus(batch: BatchData) {
  if (!batch.exists) return "FAKE" as const;
  if (batch.isRevoked) return "RECALLED" as const;
  if (batch.expiryDate * 1000 < Date.now()) return "EXPIRED" as const;
  return "AUTHENTIC" as const;
}

export default function BatchTable({ batches }: Props) {
  const navigate = useNavigate();

  if (batches.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📦</div>
        <p>No batches registered yet.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="batch-table-wrapper"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <table className="batch-table">
        <thead>
          <tr>
            <th>Batch ID</th>
            <th>Drug Name</th>
            <th>Manufacturer</th>
            <th>Expiry</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => {
            const status = getBatchStatus(batch);
            return (
              <tr
                key={batch.batchId}
                onClick={() => navigate(`/batch/${encodeURIComponent(batch.batchId)}`)}
              >
                <td className="batch-id-cell">{batch.batchId}</td>
                <td>{batch.drugName || "—"}</td>
                <td>
                  {batch.manufacturerName ? (
                    <span>
                      {batch.manufacturerName}
                      {batch.isVerified && (
                        <span className="did-verified-badge">✓ Verified</span>
                      )}
                      {batch.licenseId && (
                        <span className="did-license-id">License: {batch.licenseId}</span>
                      )}
                    </span>
                  ) : (
                    batch.manufacturer || "—"
                  )}
                </td>
                <td>
                  {batch.expiryDate
                    ? new Date(batch.expiryDate * 1000).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  <StatusBadge status={status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
}

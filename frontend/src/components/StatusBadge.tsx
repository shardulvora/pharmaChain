import { motion } from "framer-motion";
import type { BatchStatus } from "../lib/api";

const statusConfig: Record<
  BatchStatus,
  { icon: string; className: string }
> = {
  AUTHENTIC: { icon: "✓", className: "status-badge-authentic" },
  EXPIRED: { icon: "⏱", className: "status-badge-expired" },
  RECALLED: { icon: "⚠", className: "status-badge-recalled" },
  FAKE: { icon: "✗", className: "status-badge-fake" },
};

interface Props {
  status: BatchStatus;
}

export default function StatusBadge({ status }: Props) {
  const config = statusConfig[status] ?? statusConfig.FAKE;

  return (
    <motion.span
      className={`status-badge ${config.className}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {config.icon} {status}
    </motion.span>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { RiskScore } from "../lib/riskScore";

interface Props {
  riskScore: RiskScore | null;
}

export default function RiskBadge({ riskScore }: Props) {
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    if (!riskScore) {
      setAnimatedWidth(0);
      return;
    }

    setAnimatedWidth(0);
    const t = window.setTimeout(() => setAnimatedWidth(riskScore.score), 40);
    return () => window.clearTimeout(t);
  }, [riskScore]);

  const theme = useMemo(() => {
    if (!riskScore) return null;

    if (riskScore.level === "Low") {
      return {
        border: "border-green-800",
        pill: "bg-green-900/60 text-green-300 border border-green-700",
        dot: "bg-green-500",
      };
    }

    if (riskScore.level === "Medium") {
      return {
        border: "border-amber-700",
        pill: "bg-amber-900/60 text-amber-300 border border-amber-700",
        dot: "bg-amber-500",
      };
    }

    return {
      border: "border-red-800",
      pill: "bg-red-900/60 text-red-300 border border-red-700",
      dot: "bg-red-500",
    };
  }, [riskScore]);

  if (!riskScore || !theme) return null;

  const barColor =
    riskScore.score < 20 ? "bg-green-500" : riskScore.score < 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={`mt-4 rounded-xl overflow-hidden border ${theme.border}`}
    >
      <div className="flex justify-between items-center px-5 py-3">
        <p className="text-xs uppercase tracking-wider text-gray-400">AI Risk Assessment</p>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${theme.pill}`}>
          {riskScore.level} Risk
        </span>
      </div>

      <div className="px-5 py-3 bg-[#0d1117]">
        <p className="text-xs text-gray-500 mb-2">Confidence score: {riskScore.score}/100</p>
        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`${barColor} transition-all duration-700 h-2`}
            style={{ width: `${animatedWidth}%` }}
          />
        </div>
      </div>

      <div className="px-5 pb-4 space-y-1.5">
        {riskScore.reasons.map((reason) => (
          <div key={reason} className="flex items-start gap-2">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${theme.dot}`} />
            <p className="text-sm text-gray-300">{reason}</p>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5 pt-2 border-t border-gray-800 mt-2">
        <p className="text-xs text-gray-500">Recommendation:</p>
        <p className="text-sm text-gray-200 mt-1">{riskScore.recommendation}</p>
      </div>
    </motion.div>
  );
}

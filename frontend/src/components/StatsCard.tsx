import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  icon: string;
  value: number;
  label: string;
}

export default function StatsCard({ icon, value, label }: Props) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 800;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), value);
      setDisplayValue(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      className="stat-card"
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{displayValue}</div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}

export interface RiskScore {
  level: "Low" | "Medium" | "High";
  score: number; // 0-100
  reasons: string[];
  recommendation: string;
}

export function calculateRiskScore(
  scanCount: number,
  expectedUnits: number,
  alertReason: "VELOCITY_EXCEEDED" | "LOCATION_ANOMALY" | null,
  status: string,
  city?: string
): RiskScore {
  let score = 0;
  const reasons: string[] = [];

  // Rule 1: Batch not found on chain
  if (status === "FAKE" || status === "COUNTERFEIT") {
    return {
      level: "High",
      score: 99,
      reasons: ["Batch ID not registered on blockchain", "No manufacturer record found"],
      recommendation: "Do NOT consume. Dispose of immediately and report to authorities.",
    };
  }

  // Rule 2: Recalled batch
  if (status === "RECALLED") {
    return {
      level: "High",
      score: 90,
      reasons: ["Batch has been officially recalled by manufacturer"],
      recommendation: "Do NOT consume. Return to pharmacy for disposal.",
    };
  }

  // Rule 3: Location anomaly (strongest signal)
  if (alertReason === "LOCATION_ANOMALY") {
    score += 70;
    reasons.push("Same batch scanned in two different cities within 2 hours");
    reasons.push("Geographic distribution is physically impossible");
  }

  // Rule 4: Velocity exceeded
  if (alertReason === "VELOCITY_EXCEEDED") {
    const safeExpectedUnits = expectedUnits > 0 ? expectedUnits : 1;
    const excessRatio = scanCount / safeExpectedUnits;

    if (excessRatio > 2.0) {
      score += 60;
      reasons.push(
        `Scan count (${scanCount}) is ${Math.round(excessRatio * 100 - 100)}% over expected units`
      );
      reasons.push("Likely mass QR code duplication detected");
    } else if (excessRatio > 1.3) {
      score += 35;
      reasons.push(`Scan count exceeds expected units by ${Math.round(excessRatio * 100 - 100)}%`);
    } else {
      score += 15;
      reasons.push("Scan volume slightly above expected threshold");
    }
  }

  // Rule 5: Expired batch
  if (status === "EXPIRED") {
    score += 20;
    reasons.push("Batch has passed its expiry date");
  }

  // Rule 6: Normal scan activity (positive signal)
  if (!alertReason && scanCount <= expectedUnits) {
    reasons.push("Scan volume within expected range");
    reasons.push("No geographic anomalies detected");
    reasons.push("Blockchain record verified");
  }

  if (city && city.trim()) {
    reasons.push(`Latest verification location: ${city}`);
  }

  // Determine level
  const level: RiskScore["level"] = score >= 50 ? "High" : score >= 20 ? "Medium" : "Low";

  const recommendation =
    level === "High"
      ? "Exercise extreme caution. Consider this batch suspicious."
      : level === "Medium"
        ? "Proceed with caution. Contact pharmacist if unsure."
        : "This batch appears legitimate. Safe to consume.";

  return { level, score: Math.min(score, 100), reasons, recommendation };
}

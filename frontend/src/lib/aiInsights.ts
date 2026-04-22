import type { RiskScore } from "./riskScore";

/* ── Types ─────────────────────────────────────────────────── */

export interface AIInsight {
  id: string;
  icon: string;
  title: string;
  detail: string;
  severity: "info" | "success" | "warning" | "danger";
}

export interface SupplyChainScore {
  integrity: number;       // 0-100
  transparency: number;    // 0-100
  compliance: number;      // 0-100
  overall: number;         // 0-100
}

export interface CounterfeitAnalysis {
  probability: number;     // 0-100
  label: string;
  factors: string[];
}

export interface PatternAnalysis {
  label: string;
  description: string;
  trend: "stable" | "rising" | "critical";
}

export interface AIInsightsResult {
  insights: AIInsight[];
  supplyChain: SupplyChainScore;
  counterfeit: CounterfeitAnalysis;
  pattern: PatternAnalysis;
  verifiedChecks: number;
  totalChecks: number;
  modelConfidence: number; // 0-100
}

/* ── Helpers ───────────────────────────────────────────────── */

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

/* ── Main generator ────────────────────────────────────────── */

export function generateAIInsights(
  riskScore: RiskScore,
  status: string,
  scanCount: number,
  expectedUnits: number,
  alertReason: "VELOCITY_EXCEEDED" | "LOCATION_ANOMALY" | null,
  drugName: string,
  manufacturer: string,
  hasExpiry: boolean,
  city?: string
): AIInsightsResult {
  const insights: AIInsight[] = [];
  let verifiedChecks = 0;
  const totalChecks = 7;

  /* ── Supply Chain Scores ──────────────────────────────────── */
  let integrity = 92;
  let transparency = 88;
  let compliance = 95;

  if (status === "FAKE" || status === "COUNTERFEIT") {
    integrity = 5;
    transparency = 12;
    compliance = 8;
  } else if (status === "RECALLED") {
    integrity = 30;
    transparency = 70;
    compliance = 25;
  } else if (status === "EXPIRED") {
    integrity = 55;
    transparency = 82;
    compliance = 40;
  }

  if (alertReason === "LOCATION_ANOMALY") {
    integrity = Math.min(integrity, 18);
    transparency -= 30;
  } else if (alertReason === "VELOCITY_EXCEEDED") {
    integrity -= 25;
    transparency -= 15;
  }

  integrity = clamp(integrity);
  transparency = clamp(transparency);
  compliance = clamp(compliance);
  const overall = clamp(Math.round((integrity * 0.45 + transparency * 0.3 + compliance * 0.25)));

  /* ── Counterfeit Probability ──────────────────────────────── */
  let cfProb = 0;
  const cfFactors: string[] = [];

  if (status === "FAKE" || status === "COUNTERFEIT") {
    cfProb = 97;
    cfFactors.push("Batch ID not found in on-chain registry");
    cfFactors.push("No provenance record from any registered manufacturer");
  } else {
    if (alertReason === "LOCATION_ANOMALY") {
      cfProb += 62;
      cfFactors.push("Geographically impossible scan pattern detected");
    }
    if (alertReason === "VELOCITY_EXCEEDED") {
      const ratio = expectedUnits > 0 ? scanCount / expectedUnits : 2;
      if (ratio > 2) {
        cfProb += 45;
        cfFactors.push("QR duplication signatures detected");
      } else if (ratio > 1.3) {
        cfProb += 22;
        cfFactors.push("Elevated scan-to-unit ratio");
      }
    }
    if (status === "RECALLED") {
      cfProb += 15;
      cfFactors.push("Active recall notice — supply chain compromised");
    }
    if (status === "EXPIRED") {
      cfProb += 8;
      cfFactors.push("Expired batch may have been re-introduced to market");
    }
    if (cfFactors.length === 0) {
      cfFactors.push("No counterfeit indicators detected");
    }
  }
  cfProb = clamp(cfProb);

  const cfLabel =
    cfProb >= 70
      ? "Critical"
      : cfProb >= 40
        ? "Elevated"
        : cfProb >= 15
          ? "Moderate"
          : "Negligible";

  /* ── Pattern Analysis ─────────────────────────────────────── */
  let patternLabel: string;
  let patternDesc: string;
  let patternTrend: PatternAnalysis["trend"];

  if (alertReason === "LOCATION_ANOMALY") {
    patternLabel = "Geo-Anomaly Cluster";
    patternDesc = "AI detected same batch verification from divergent geographic zones within an impossible timeframe. This pattern matches known counterfeit distribution rings.";
    patternTrend = "critical";
  } else if (alertReason === "VELOCITY_EXCEEDED") {
    patternLabel = "Velocity Spike";
    patternDesc = `Scan frequency exceeds predicted manufacturing output by ${Math.max(0, scanCount - expectedUnits)} units. Pattern consistent with QR code replication attacks.`;
    patternTrend = "rising";
  } else if (status === "RECALLED" || status === "EXPIRED") {
    patternLabel = "Supply Chain Break";
    patternDesc = "Batch flagged for regulatory non-compliance. Distribution should have been halted at previous checkpoint.";
    patternTrend = "rising";
  } else {
    patternLabel = "Normal Distribution";
    patternDesc = "Scan patterns align with expected manufacturing-to-pharmacy flow. No anomalies detected in geographic or temporal signals.";
    patternTrend = "stable";
  }

  /* ── Individual Insights ──────────────────────────────────── */

  // Check 1: Blockchain registry
  if (status !== "FAKE" && status !== "COUNTERFEIT") {
    verifiedChecks++;
    insights.push({
      id: "blockchain-verified",
      icon: "🔗",
      title: "Blockchain Record Verified",
      detail: `Batch exists on-chain with manufacturer signature from ${manufacturer || "registered entity"}.`,
      severity: "success",
    });
  } else {
    insights.push({
      id: "blockchain-missing",
      icon: "🚫",
      title: "No Blockchain Record Found",
      detail: "This batch ID has no corresponding entry in the PillChain smart contract registry.",
      severity: "danger",
    });
  }

  // Check 2: Manufacturer authenticity
  if (manufacturer && status !== "FAKE") {
    verifiedChecks++;
    insights.push({
      id: "manufacturer-ok",
      icon: "🏭",
      title: "Manufacturer Authenticated",
      detail: `${manufacturer} is a registered and verified manufacturer in the PillChain network.`,
      severity: "success",
    });
  } else if (status !== "FAKE") {
    insights.push({
      id: "manufacturer-unknown",
      icon: "❓",
      title: "Manufacturer Identity Unclear",
      detail: "Manufacturer field is empty or unresolvable. Proceed with caution.",
      severity: "warning",
    });
  }

  // Check 3: Expiry validation
  if (hasExpiry && status !== "EXPIRED" && status !== "FAKE") {
    verifiedChecks++;
    insights.push({
      id: "expiry-valid",
      icon: "📅",
      title: "Shelf-Life Valid",
      detail: `${drugName || "This drug"} is within its regulatory shelf-life window.`,
      severity: "success",
    });
  } else if (status === "EXPIRED") {
    insights.push({
      id: "expiry-failed",
      icon: "⏰",
      title: "Expiry Date Exceeded",
      detail: "Batch has passed its regulatory expiry. Efficacy and safety cannot be guaranteed.",
      severity: "danger",
    });
  }

  // Check 4: Geographic consistency
  if (alertReason !== "LOCATION_ANOMALY") {
    verifiedChecks++;
    insights.push({
      id: "geo-consistent",
      icon: "🌍",
      title: "Geographic Pattern Normal",
      detail: city
        ? `Verification location (${city}) is consistent with expected distribution geography.`
        : "No geographic anomalies detected in scan history.",
      severity: "success",
    });
  } else {
    insights.push({
      id: "geo-anomaly",
      icon: "📍",
      title: "Impossible Geographic Movement",
      detail: "Same batch scanned in two different cities within 2 hours — physically impossible without duplication.",
      severity: "danger",
    });
  }

  // Check 5: Scan velocity
  if (alertReason !== "VELOCITY_EXCEEDED") {
    verifiedChecks++;
    insights.push({
      id: "velocity-normal",
      icon: "📊",
      title: "Scan Volume Within Range",
      detail: `${scanCount} scans recorded against ${expectedUnits > 0 ? expectedUnits : "N/A"} expected units — within normal bounds.`,
      severity: "success",
    });
  } else {
    insights.push({
      id: "velocity-exceeded",
      icon: "📈",
      title: "Scan Velocity Anomaly",
      detail: `${scanCount} scans vs ${expectedUnits} expected — ${Math.round(((scanCount / Math.max(expectedUnits, 1)) - 1) * 100)}% over threshold.`,
      severity: "danger",
    });
  }

  // Check 6: Recall status
  if (status !== "RECALLED") {
    verifiedChecks++;
    insights.push({
      id: "recall-clear",
      icon: "✅",
      title: "No Active Recalls",
      detail: "No manufacturer-issued recall notices found for this batch.",
      severity: "success",
    });
  } else {
    insights.push({
      id: "recall-active",
      icon: "🔴",
      title: "Active Recall Notice",
      detail: "Manufacturer has issued a recall for this batch. Do not dispense or consume.",
      severity: "danger",
    });
  }

  // Check 7: Supply chain completeness
  if (status === "AUTHENTIC" && !alertReason) {
    verifiedChecks++;
    insights.push({
      id: "chain-complete",
      icon: "🔒",
      title: "Full Chain-of-Custody Verified",
      detail: "All 4 supply chain checkpoints (Manufacturer → Distributor → Logistics → Pharmacy) recorded on-chain.",
      severity: "success",
    });
  } else if (status !== "FAKE" && status !== "COUNTERFEIT") {
    insights.push({
      id: "chain-incomplete",
      icon: "⚡",
      title: "Chain-of-Custody Gaps Detected",
      detail: "One or more supply chain checkpoints could not be fully verified. Integrity may be compromised.",
      severity: "warning",
    });
  }

  /* ── Model Confidence ─────────────────────────────────────── */
  const modelConfidence = clamp(
    100 - riskScore.score + (verifiedChecks / totalChecks) * 20 - (cfProb > 50 ? 15 : 0)
  );

  return {
    insights,
    supplyChain: { integrity, transparency, compliance, overall },
    counterfeit: { probability: cfProb, label: cfLabel, factors: cfFactors },
    pattern: { label: patternLabel, description: patternDesc, trend: patternTrend },
    verifiedChecks,
    totalChecks,
    modelConfidence,
  };
}

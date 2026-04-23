import { useState, useEffect } from "react";
import { getAINarrative, type NarrativeResponse } from "../lib/api";

interface VerifyResultForNarrative {
  data: {
    batchId?: string;
    drugName?: string;
    manufacturer?: string;
    isVerified?: boolean;
  };
  status: string;
  scanCount: number;
  expectedUnits: number;
  alertReason: string | null;
  currentLocation?: { city?: string };
  message: string;
}

function buildClientFallback(r: VerifyResultForNarrative): NarrativeResponse {
  const isHighRisk =
    r.status === "FAKE" ||
    r.status === "RECALLED" ||
    r.alertReason === "LOCATION_ANOMALY";

  const isMediumRisk =
    r.status === "EXPIRED" || r.alertReason === "VELOCITY_EXCEEDED";

  const riskLevel: "Low" | "Medium" | "High" = isHighRisk
    ? "High"
    : isMediumRisk
      ? "Medium"
      : "Low";

  const confidence = isHighRisk ? 90 : isMediumRisk ? 78 : 92;

  const alertText = r.alertReason
    ? ` A fraud alert has been triggered: ${r.alertReason.replace(/_/g, " ").toLowerCase()}.`
    : " No anomalies detected in this verification.";

  const narrative =
    riskLevel === "Low"
      ? `${r.data.drugName ?? "This medicine"} has been successfully verified on the PillChain blockchain. The batch appears authentic and the manufacturer is registered.${alertText}`
      : riskLevel === "Medium"
        ? `${r.data.drugName ?? "This medicine"} has been found with status: ${r.status}.${alertText} Please exercise caution.`
        : `WARNING: ${r.data.drugName ?? "This medicine"} has a high-risk status: ${r.status}.${alertText} Do not consume without pharmacist confirmation.`;

  const keyFindings: string[] = [
    `Blockchain status: ${r.status}`,
    `Scan count: ${r.scanCount} of ${r.expectedUnits > 0 ? r.expectedUnits : "N/A"} expected units`,
    `Manufacturer verified on-chain: ${r.data.isVerified ? "Yes" : "No"}`,
  ];

  const recommendation =
    riskLevel === "Low"
      ? "This medicine is safe to consume. Keep it stored as directed on the packaging."
      : riskLevel === "Medium"
        ? "Consult your pharmacist before consuming this medicine."
        : "Do NOT consume this medicine. Report it to your pharmacist or health authority immediately.";

  return {
    narrative,
    riskLevel,
    confidence,
    keyFindings,
    recommendation,
    model: "client-fallback",
  };
}

export function useAINarrative(result: VerifyResultForNarrative | null) {
  const [narrative, setNarrative] = useState<NarrativeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNarrative(null);
    setError(null);

    if (!result) return;

    if (result.message === "COUNTERFEIT") {
      setNarrative(buildClientFallback(result));
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getAINarrative({
      batchId: result.data.batchId ?? "UNKNOWN",
      drugName: result.data.drugName ?? "Unknown Drug",
      manufacturer: result.data.manufacturer ?? "Unknown",
      status: result.status,
      scanCount: result.scanCount,
      expectedUnits: result.expectedUnits,
      alertReason: result.alertReason,
      city: result.currentLocation?.city,
      isVerified: result.data.isVerified ?? false,
    }).then((data) => {
      if (cancelled) return;
      setNarrative(data ?? buildClientFallback(result));
      setIsLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setNarrative(buildClientFallback(result));
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [result?.data?.batchId, result?.status, result?.scanCount]);

  return { narrative, isLoading, error };
}

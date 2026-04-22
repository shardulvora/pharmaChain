import { verifyBatch as verifyBatchFromChain } from "./api";
import { supabase } from "./supabase";

export interface VerifyResult {
  batchId: string;
  drugName: string;
  manufacturer: string;
  status: "AUTHENTIC" | "EXPIRED" | "RECALLED" | "FAKE";
  message: "SAFE" | "WARNING" | "COUNTERFEIT";
  expiryDate?: string;
  scanCount: number;
  expectedUnits: number;
  alertTriggered: boolean;
  alertReason: "VELOCITY_EXCEEDED" | "LOCATION_ANOMALY" | null;
  currentLocation: { lat: number; lng: number; city: string; country: string };
  previousScan: { city: string; scanned_at: string } | null;
}

export async function verifyBatchWithSecurity(
  batchId: string,
  lat: number,
  lng: number
): Promise<VerifyResult> {
  const normalizedBatchId = batchId.trim().toUpperCase();

  let city = "Unknown";
  let country = "Unknown";

  let expectedUnits = 999;
  let scanCount = 0;
  let previousScan: { city: string; scanned_at: string } | null = null;

  let alertTriggered = false;
  let alertReason: "VELOCITY_EXCEEDED" | "LOCATION_ANOMALY" | null = null;

  let status: "AUTHENTIC" | "EXPIRED" | "RECALLED" | "FAKE" = "FAKE";
  let drugName = "Unknown";
  let manufacturer = "Unknown";
  let expiryDate: string | undefined;

  // STEP 1 — Reverse geocode
  console.log("STEP 1 - Reverse geocode");
  try {
    const geoRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    const geoData = (await geoRes.json()) as {
      city?: string;
      locality?: string;
      countryName?: string;
    };

    city = geoData.city || geoData.locality || "Unknown";
    country = geoData.countryName || "Unknown";
  } catch (error) {
    console.error("STEP 1 failed:", error);
    city = "Unknown";
    country = "Unknown";
  }

  // STEP 2 — Get expected units from batch_limits
  console.log("STEP 2 - Load expected units from Supabase");
  try {
    const { data: batchLimit } = await supabase
      .from("batch_limits")
      .select("expected_units")
      .eq("batch_id", normalizedBatchId)
      .single();

    expectedUnits = batchLimit?.expected_units ?? 999;
  } catch (error) {
    console.error("STEP 2 failed:", error);
    expectedUnits = 999;
  }

  // STEP 3 — Get current scan count
  console.log("STEP 3 - Count scans from Supabase");
  try {
    const { count } = await supabase
      .from("scan_logs")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", normalizedBatchId);

    scanCount = count ?? 0;
  } catch (error) {
    console.error("STEP 3 failed:", error);
    scanCount = 0;
  }

  // STEP 4 — Get previous scan
  console.log("STEP 4 - Fetch previous scan");
  try {
    const { data: prevScans } = await supabase
      .from("scan_logs")
      .select("city, scanned_at")
      .eq("batch_id", normalizedBatchId)
      .order("scanned_at", { ascending: false })
      .limit(1);

    const row = prevScans?.[0] as { city: string | null; scanned_at: string } | undefined;
    previousScan = row
      ? {
          city: row.city ?? "Unknown",
          scanned_at: row.scanned_at,
        }
      : null;
  } catch (error) {
    console.error("STEP 4 failed:", error);
    previousScan = null;
  }

  // STEP 5 — Velocity check
  console.log("STEP 5 - Velocity anomaly check");
  try {
    if ((scanCount ?? 0) > expectedUnits * 1.1) {
      alertTriggered = true;
      alertReason = "VELOCITY_EXCEEDED";
    }
  } catch (error) {
    console.error("STEP 5 failed:", error);
  }

  // STEP 6 — Location anomaly check
  console.log("STEP 6 - Location anomaly check");
  try {
    if (!alertTriggered && previousScan && previousScan.city !== city && city !== "Unknown") {
      const minutesDiff = Math.floor(
        (Date.now() - new Date(previousScan.scanned_at).getTime()) / 60000
      );
      if (minutesDiff < 120) {
        alertTriggered = true;
        alertReason = "LOCATION_ANOMALY";
      }
    }
  } catch (error) {
    console.error("STEP 6 failed:", error);
  }

  // STEP 7 — Call backend for chain data
  console.log("STEP 7 - Verify against chain backend");
  try {
    const chainData = await verifyBatchFromChain(normalizedBatchId);

    if (chainData && chainData.status) {
      status = chainData.status;
      drugName = chainData.data?.drugName || "Unknown";
      manufacturer = chainData.data?.manufacturer || "Unknown";

      if (chainData.data?.expiryISO) {
        expiryDate = chainData.data.expiryISO;
      } else if (chainData.data?.expiryDate) {
        expiryDate = new Date(chainData.data.expiryDate * 1000).toISOString();
      }
    } else {
      status = "FAKE";
    }
  } catch (error) {
    console.error("STEP 7 failed:", error);
    status = "FAKE";
  }

  // STEP 8 — Log scan to Supabase (fire and forget)
  console.log("STEP 8 - Log scan");
  try {
    void supabase
      .from("scan_logs")
      .insert({
        batch_id: normalizedBatchId,
        lat,
        lng,
        city,
        country,
        alert_triggered: alertTriggered,
        alert_reason: alertReason,
      })
      .then(
        () => {},
        () => {}
      );
  } catch (error) {
    console.error("STEP 8 failed:", error);
  }

  // STEP 9 — Build final combined result
  console.log("STEP 9 - Build result payload");
  try {
    const message: "SAFE" | "WARNING" | "COUNTERFEIT" =
      status === "FAKE" ? "COUNTERFEIT" : alertTriggered ? "WARNING" : "SAFE";

    return {
      batchId: normalizedBatchId,
      drugName,
      manufacturer,
      status,
      message,
      expiryDate,
      scanCount,
      expectedUnits,
      alertTriggered,
      alertReason,
      currentLocation: { lat, lng, city, country },
      previousScan,
    };
  } catch (error) {
    console.error("STEP 9 failed:", error);
    return {
      batchId: normalizedBatchId,
      drugName: "Unknown",
      manufacturer: "Unknown",
      status: "FAKE",
      message: "COUNTERFEIT",
      expiryDate: undefined,
      scanCount,
      expectedUnits,
      alertTriggered,
      alertReason,
      currentLocation: { lat, lng, city, country },
      previousScan,
    };
  }
}

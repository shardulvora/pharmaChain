import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { toPng } from "html-to-image";
import { verifyBatch, type VerifyResponse } from "../lib/api";
import {
  getBatchLimit,
  getScanAnalytics,
  logScan,
  type PreviousScan,
} from "../lib/scanTracking";
import SecurityAlert from "../components/SecurityAlert";
import AIInsightsPanel from "../components/AIInsightsPanel";
import { calculateRiskScore } from "../lib/riskScore";

const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

type VerifyTab = "scan" | "manual";
type VerifyViewState = "SAFE" | "WARNING" | "COUNTERFEIT";

interface TimelineStep {
  actor: string;
  role: "Manufacturer" | "Distributor" | "Logistics" | "Pharmacy";
  location: string;
  timestamp: string;
  txHash: string;
}

interface WarningFlag {
  label: string;
  detail: string;
}

interface ClientScanContext {
  lat: number | null;
  lng: number | null;
  city: string | null;
  country: string | null;
  ipAddress: string | null;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface MultiProviderEthereum extends EthereumProvider {
  providers?: EthereumProvider[];
}

type AlertReason = "VELOCITY_EXCEEDED" | "LOCATION_ANOMALY" | null;

interface VerifyResult extends VerifyResponse {
  alertReason: AlertReason;
  scanCount: number;
  expectedUnits: number;
  previousScan: PreviousScan | null;
  currentLocation: {
    lat?: number;
    lng?: number;
    city: string;
    country: string;
  } | null;
}

type DemoMode = "safe" | "velocity" | "location";

const DEMO_RESULTS: Record<DemoMode, VerifyResult> = {
  safe: {
    status: "AUTHENTIC",
    message: "SAFE",
    data: {
      batchId: "DEMO-BATCH-001",
      drugName: "Demo Drug",
      manufacturer: "Demo Manufacturer",
      expiryDate: Math.floor(new Date("2026-12-31").getTime() / 1000),
      expiryISO: "2026-12-31T00:00:00.000Z",
      registeredBy: "",
      isRevoked: false,
      exists: true,
    },
    scanCount: 45,
    expectedUnits: 100,
    alertTriggered: false,
    alertReason: null,
    currentLocation: { lat: 19.07, lng: 72.87, city: "Mumbai", country: "India" },
    previousScan: null,
  },
  velocity: {
    status: "AUTHENTIC",
    message: "WARNING",
    data: {
      batchId: "PCH-2024-001",
      drugName: "Amoxicillin 500mg",
      manufacturer: "BioMed Labs",
      expiryDate: Math.floor(new Date("2025-08-15").getTime() / 1000),
      expiryISO: "2025-08-15T00:00:00.000Z",
      registeredBy: "",
      isRevoked: false,
      exists: true,
    },
    scanCount: 623,
    expectedUnits: 500,
    alertTriggered: true,
    alertReason: "VELOCITY_EXCEEDED",
    currentLocation: { lat: 12.97, lng: 77.59, city: "Bangalore", country: "India" },
    previousScan: null,
  },
  location: {
    status: "AUTHENTIC",
    message: "WARNING",
    data: {
      batchId: "PCH-2024-001",
      drugName: "Amoxicillin 500mg",
      manufacturer: "BioMed Labs",
      expiryDate: Math.floor(new Date("2025-08-15").getTime() / 1000),
      expiryISO: "2025-08-15T00:00:00.000Z",
      registeredBy: "",
      isRevoked: false,
      exists: true,
    },
    scanCount: 48,
    expectedUnits: 500,
    alertTriggered: true,
    alertReason: "LOCATION_ANOMALY",
    currentLocation: { lat: 28.61, lng: 77.20, city: "Delhi", country: "India" },
    previousScan: {
      city: "Bangalore",
      scanned_at: new Date(Date.now() - 18 * 60000).toISOString(),
    },
  },
};

type VerificationSource = "onchain" | "backend";

const PILLCHAIN_VERIFY_ABI = [
  {
    inputs: [{ internalType: "address", name: "addr", type: "address" }],
    name: "getManufacturer",
    outputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "licenseId", type: "string" },
      { internalType: "bool", name: "isVerified", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_batchId", type: "string" }],
    name: "verifyBatch",
    outputs: [
      { internalType: "bool", name: "isAuthentic", type: "bool" },
      { internalType: "bool", name: "isExpired", type: "bool" },
      { internalType: "bool", name: "isRevoked", type: "bool" },
      {
        components: [
          { internalType: "string", name: "batchId", type: "string" },
          { internalType: "string", name: "drugName", type: "string" },
          { internalType: "string", name: "manufacturer", type: "string" },
          { internalType: "uint256", name: "expiryDate", type: "uint256" },
          { internalType: "address", name: "registeredBy", type: "address" },
          { internalType: "bool", name: "isRevoked", type: "bool" },
          { internalType: "bool", name: "exists", type: "bool" },
        ],
        internalType: "struct PillChain.DrugBatch",
        name: "batch",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

function extractBatchId(raw: string): string {
  const trimmed = raw.trim();
  const normalize = (value: string) => value.trim().toUpperCase();

  try {
    const url = new URL(trimmed);
    const chunks = url.pathname.split("/").filter(Boolean);
    if (chunks.length > 0) {
      return normalize(decodeURIComponent(chunks[chunks.length - 1]));
    }
  } catch {
    // Not a URL, parse plain batch value.
  }

  try {
    return normalize(decodeURIComponent(trimmed));
  } catch {
    return normalize(trimmed);
  }
}

function pseudoHex(seed: string, length: number): string {
  const chars = "0123456789abcdef";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  let out = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.abs((hash + i * 13 + seed.length * 17) % chars.length);
    out += chars[idx];
  }
  return out;
}

function formatHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function getDeterministicNumber(input: string, mod: number): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value += input.charCodeAt(i) * (i + 3);
  }
  return value % mod;
}

function buildTimeline(batchId: string, manufacturer: string): TimelineStep[] {
  const locations = [
    "Mumbai Manufacturing Plant",
    "Navi Mumbai Cold Hub",
    "Pune Regional Distribution Center",
    "CityCare Pharmacy Network",
  ];

  const actors = [
    manufacturer || "Certified Pharma Unit",
    "Apex Distribution Pvt Ltd",
    "BlueLine Cold Logistics",
    "CityCare Pharmacy",
  ];

  const roles: TimelineStep["role"][] = [
    "Manufacturer",
    "Distributor",
    "Logistics",
    "Pharmacy",
  ];

  const baseTime = Date.now() - (getDeterministicNumber(batchId, 96) + 12) * 60 * 60 * 1000;

  return roles.map((role, index) => {
    const isoTime = new Date(baseTime + index * 8 * 60 * 60 * 1000).toISOString();
    const txHash = `0x${pseudoHex(`${batchId}-${role}-${index}`, 64)}`;

    return {
      actor: actors[index],
      role,
      location: locations[index],
      timestamp: isoTime,
      txHash,
    };
  });
}

function buildWarningFlags(batchId: string, status: VerifyResponse["status"]): WarningFlag[] {
  const probe = getDeterministicNumber(batchId, 5);

  const flags: WarningFlag[] = [
    {
      label: "Temperature Violation Detected",
      detail: `Cold-chain sensor breach at Transit Hub 2: 14.${probe}°C for ${25 + probe * 4} minutes (max allowed 8°C).`,
    },
  ];

  if (status === "EXPIRED") {
    flags.push({
      label: "Shelf-Life Exceeded",
      detail: "Batch has crossed regulatory expiry and must not be dispensed.",
    });
  }

  if (status === "RECALLED") {
    flags.push({
      label: "Recall Notice Active",
      detail: "Manufacturer has marked this lot as recalled. Quarantine advised.",
    });
  }

  return flags;
}

async function getClientScanContext(): Promise<ClientScanContext> {
  const geoPromise = new Promise<{ lat: number | null; lng: number | null }>((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => resolve({ lat: null, lng: null }),
      { timeout: 3000, enableHighAccuracy: false, maximumAge: 60_000 }
    );
  });

  const ipPromise = fetch("https://ipapi.co/json/")
    .then(async (res) => {
      if (!res.ok) {
        return { ipAddress: null, city: null, country: null };
      }
      const json = (await res.json()) as { ip?: string; city?: string; country_name?: string };
      return {
        ipAddress: json.ip ?? null,
        city: json.city ?? null,
        country: json.country_name ?? null,
      };
    })
    .catch(() => ({ ipAddress: null, city: null, country: null }));

  const [geo, ipInfo] = await Promise.all([geoPromise, ipPromise]);

  return {
    lat: geo.lat,
    lng: geo.lng,
    city: ipInfo.city,
    country: ipInfo.country,
    ipAddress: ipInfo.ipAddress,
  };
}

export default function VerifyPage() {
  const [activeTab, setActiveTab] = useState<VerifyTab>("scan");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [verificationSource, setVerificationSource] = useState<VerificationSource | null>(
    null
  );
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [warningFlags, setWarningFlags] = useState<WarningFlag[]>([]);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [scannerError, setScannerError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [demoMode, setDemoMode] = useState<DemoMode | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStartingRef = useRef(false);
  const scannedLockRef = useRef(false);
  const resultCardRef = useRef<HTMLDivElement | null>(null);

  const scannerElementId = "vault-qr-reader";

  const getMetaMaskProvider = (): EthereumProvider | null => {
    const ethereum = (window as Window & { ethereum?: MultiProviderEthereum }).ethereum;
    if (!ethereum) return null;

    if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
      const mm = ethereum.providers.find((provider) => provider.isMetaMask);
      return mm ?? null;
    }

    if (ethereum.isMetaMask) return ethereum;
    return ethereum;
  };

  const connectWallet = async () => {
    const ethereumProvider = getMetaMaskProvider();
    if (!ethereumProvider) {
      setWalletError("MetaMask not detected. Open in Chrome/Edge with extension enabled.");
      return;
    }
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(ethereumProvider as never);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setWalletError(null);
    } catch {
      setWalletError("Wallet connection rejected.");
    }
  };

  // Task 1 — demo mode detection from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demo = params.get("demo");
    if (demo && (demo === "safe" || demo === "velocity" || demo === "location")) {
      setDemoMode(demo as DemoMode);
      const demoResult = DEMO_RESULTS[demo as DemoMode];
      setResult(demoResult);
      setVerificationSource("backend");
      setTimeline(buildTimeline(demoResult.data.batchId, demoResult.data.manufacturer));
      setWarningFlags(
        demoResult.alertReason
          ? [{ label: demoResult.alertReason === "VELOCITY_EXCEEDED" ? "Velocity Threshold Exceeded" : "Suspicious Location Jump", detail: demoResult.alertReason === "VELOCITY_EXCEEDED" ? `Scan count (${demoResult.scanCount}) exceeds expected units (${demoResult.expectedUnits}).` : `Scanned in ${demoResult.currentLocation?.city} shortly after a scan in ${demoResult.previousScan?.city}.` }]
          : []
      );
    }
  }, []);

  useEffect(() => {
    const hydrateWallet = async () => {
      const ethereumProvider = getMetaMaskProvider();
      if (!ethereumProvider) return;

      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(ethereumProvider as never);
        const accounts = (await provider.send("eth_accounts", [])) as string[];
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletError(null);
        }
      } catch {
        // Ignore hydration failures and let user click connect.
      }
    };

    hydrateWallet();
  }, []);

  const trackScan = useCallback(
    async (
      normalizedBatchId: string,
      viewState: VerifyViewState,
      reason?: string
    ) => {
      try {
        const context = await getClientScanContext();
        await logScan({
          batchId: normalizedBatchId,
          lat: context.lat,
          lng: context.lng,
          city: context.city,
          country: context.country,
          ipAddress: context.ipAddress,
          userAgent: navigator.userAgent,
          alertTriggered: viewState !== "SAFE",
          alertReason: reason ?? null,
        });
      } catch {
        // Non-blocking analytics path: verification UX must continue.
      }
    },
    []
  );

  const verifyBatchOnChain = useCallback(
    async (normalizedBatchId: string): Promise<VerifyResponse> => {
      const ethereumProvider = getMetaMaskProvider();
      if (!ethereumProvider) {
        throw new Error("Wallet provider unavailable");
      }

      if (
        !CONTRACT_ADDRESS ||
        CONTRACT_ADDRESS.toLowerCase() === "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error("Contract address not configured");
      }

      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(ethereumProvider as never);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PILLCHAIN_VERIFY_ABI, provider);

      const result = (await contract.verifyBatch(normalizedBatchId)) as [
        boolean,
        boolean,
        boolean,
        {
          batchId?: string;
          drugName?: string;
          manufacturer?: string;
          expiryDate?: bigint;
          registeredBy?: string;
          isRevoked?: boolean;
          exists?: boolean;
        }
      ];

      const isAuthentic = Boolean(result[0]);
      const isExpired = Boolean(result[1]);
      const isRevoked = Boolean(result[2]);
      const batch = result[3] ?? {};
      const expiryDate = Number(batch.expiryDate ?? 0n);
      const registeredBy = batch.registeredBy || "";
      let manufacturerName: string | null = null;
      let licenseId: string | null = null;
      let isVerified = false;

      if (registeredBy) {
        try {
          const manufacturerResult = (await contract.getManufacturer(registeredBy)) as [
            string,
            string,
            boolean
          ];
          manufacturerName = manufacturerResult[0] || null;
          licenseId = manufacturerResult[1] || null;
          isVerified = Boolean(manufacturerResult[2]);
        } catch {
          // Keep verification path non-blocking if DID lookup fails.
        }
      }

      const data: VerifyResponse["data"] = {
        batchId: batch.batchId || normalizedBatchId,
        drugName: batch.drugName || "",
        manufacturer: batch.manufacturer || "",
        expiryDate,
        expiryISO: expiryDate > 0 ? new Date(expiryDate * 1000).toISOString() : null,
        registeredBy,
        isRevoked: Boolean(batch.isRevoked),
        exists: Boolean(batch.exists),
        manufacturerName,
        licenseId,
        isVerified,
      };

      if (!isAuthentic) {
        return {
          status: "FAKE",
          message: "Batch ID not found in registry.",
          data,
        };
      }

      if (isRevoked) {
        return {
          status: "RECALLED",
          message: "DANGER: This batch has been recalled by the manufacturer!",
          data,
        };
      }

      if (isExpired) {
        return {
          status: "EXPIRED",
          message: "WARNING: This drug has passed its expiration date.",
          data,
        };
      }

      return {
        status: "AUTHENTIC",
        message: "Drug verified against the blockchain.",
        data,
      };
    },
    []
  );

  const verifyState = useMemo<VerifyViewState | null>(() => {
    if (!result) return null;
    if (result.status === "FAKE") return "COUNTERFEIT";

    const ruleBasedTempBreach = getDeterministicNumber(result.data.batchId || batchId, 4) === 1;
    if (result.status === "RECALLED" || result.status === "EXPIRED" || ruleBasedTempBreach) {
      return "WARNING";
    }

    return "SAFE";
  }, [batchId, result]);

  const riskScore = useMemo(() => {
    if (!result) return null;

    return calculateRiskScore(
      result.scanCount,
      result.expectedUnits,
      result.alertReason,
      result.status,
      result.currentLocation?.city
    );
  }, [result]);

  useEffect(() => {
    const shouldScan = activeTab === "scan";

    async function stopScanner() {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      try {
        if (scanner.getState() === 2) {
          await scanner.stop();
        }
      } catch {
        // Ignore shutdown failures.
      }
      try {
        await scanner.clear();
      } catch {
        // Ignore clear failures.
      }
    }

    if (!shouldScan) {
      stopScanner();
      return;
    }

    let cancelled = false;
    scannedLockRef.current = false;
    setScannerError("");

    const mountScanner = async () => {
      if (scannerStartingRef.current) return;
      scannerStartingRef.current = true;

      try {
        const root = document.getElementById(scannerElementId);
        if (root) {
          root.innerHTML = "";
        }

        const scanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decodedText) => {
            if (cancelled || scannedLockRef.current) return;
            scannedLockRef.current = true;

            const parsed = extractBatchId(decodedText);
            setBatchId(parsed);
            setActiveTab("manual");

            window.setTimeout(() => {
              scannedLockRef.current = false;
            }, 1200);
          },
          () => {
            // Ignore scan misses while camera is open.
          }
        );
      } catch {
        if (!cancelled) {
          setScannerError("Camera access failed. Allow camera permission and retry.");
        }
      } finally {
        scannerStartingRef.current = false;
      }
    };

    mountScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [activeTab]);

  const runVerify = useCallback(async (rawBatchId: string) => {
    const normalized = extractBatchId(rawBatchId);
    if (!normalized) {
      setError("Please enter a valid batch ID.");
      return;
    }

    setBatchId(normalized);
    setError("");
    setResult(null);
    setVerificationSource(null);
    setWarningFlags([]);
    setTimeline([]);
    setLoading(true);

    try {
      let source: VerificationSource = "backend";
      let response: VerifyResponse;

      if (walletAddress) {
        try {
          response = await verifyBatchOnChain(normalized);
          source = "onchain";
        } catch {
          response = await verifyBatch(normalized);
          source = "backend";
        }
      } else {
        response = await verifyBatch(normalized);
      }

      const context = await getClientScanContext();

      await new Promise((resolve) => window.setTimeout(resolve, 2200));
      setVerificationSource(source);

      const [batchLimit, scanAnalytics] = await Promise.all([
        getBatchLimit(normalized),
        getScanAnalytics(normalized),
      ]);

      const scanCount = scanAnalytics.scanCount + 1;
      const expectedUnits = batchLimit?.expected_units ?? 0;
      const previousScan = scanAnalytics.previousScan;
      const currentCity = context.city ?? "";

      let securityAlertReason: AlertReason = null;

      if (expectedUnits > 0 && scanCount > expectedUnits) {
        securityAlertReason = "VELOCITY_EXCEEDED";
      }

      if (
        previousScan?.city &&
        currentCity &&
        previousScan.city.toLowerCase() !== currentCity.toLowerCase()
      ) {
        const minutesBetweenScans = Math.floor(
          (Date.now() - new Date(previousScan.scanned_at).getTime()) / 60000
        );
        if (minutesBetweenScans <= 120) {
          securityAlertReason = "LOCATION_ANOMALY";
        }
      }

      const enrichedResponse: VerifyResult = {
        ...response,
        alertReason: securityAlertReason,
        scanCount,
        expectedUnits,
        previousScan,
        currentLocation: {
          city: currentCity,
          country: context.country ?? "",
        },
      };

      setResult(enrichedResponse);
      setTimeline(buildTimeline(response.data.batchId || normalized, response.data.manufacturer));

      let derivedViewState: VerifyViewState;
      if (response.status === "FAKE") {
        derivedViewState = "COUNTERFEIT";
        setWarningFlags([]);
        void trackScan(normalized, derivedViewState, "Batch not found on blockchain");
      } else {
        const flags = buildWarningFlags(response.data.batchId || normalized, response.status);
        const ruleBasedTempBreach = getDeterministicNumber(response.data.batchId || normalized, 4) === 1;
        derivedViewState =
          response.status === "RECALLED" || response.status === "EXPIRED" || ruleBasedTempBreach
            ? "WARNING"
            : "SAFE";
        setWarningFlags(flags);
        void trackScan(
          normalized,
          derivedViewState,
          securityAlertReason ?? flags[0]?.label
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }, [verifyBatchOnChain, walletAddress]);

  const onVerifySubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runVerify(batchId);
  };

  const onShare = async () => {
    if (!resultCardRef.current || !result) return;

    try {
      setSharing(true);
      const dataUrl = await toPng(resultCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050b1f",
      });

      const anchor = document.createElement("a");
      const safeBatchId = (result.data.batchId || "result").replace(/[^a-z0-9_-]/gi, "_");
      anchor.href = dataUrl;
      anchor.download = `pharmachain-${safeBatchId}.png`;
      anchor.click();
    } catch {
      setError("Could not generate share card image. Try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <section className="vault-verify-page min-h-screen overflow-x-hidden">
      <motion.div
        className="vault-shell"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="vault-heading">
          <p className="vault-eyebrow">PharmaChain Verification Vault</p>
          <h1>Unlock medicine trust in seconds</h1>
          <p>Scan a package QR or type a batch ID to query on-chain provenance.</p>
        </div>

        <div className="vault-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
            <div>
              <p className="vault-help-text">Security-aware verification</p>
            </div>
            <div style={{ display: "grid", justifyItems: "end", gap: "6px" }}>
              {!walletAddress ? (
                <button
                  type="button"
                  className="vault-wallet-btn"
                  onClick={connectWallet}
                >
                  🔗 Connect Wallet
                </button>
              ) : (
                <span className="vault-wallet-badge">
                  ✅ {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              )}
              {walletError && <p className="vault-wallet-error">{walletError}</p>}
            </div>
          </div>

          <div className="vault-tabs" role="tablist" aria-label="Batch verification tabs">
            <button
              role="tab"
              type="button"
              className={`vault-tab-btn ${activeTab === "scan" ? "active" : ""}`}
              aria-selected={activeTab === "scan"}
              onClick={() => setActiveTab("scan")}
            >
              Scan QR
            </button>
            <button
              role="tab"
              type="button"
              className={`vault-tab-btn ${activeTab === "manual" ? "active" : ""}`}
              aria-selected={activeTab === "manual"}
              onClick={() => setActiveTab("manual")}
            >
              Enter Batch ID
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "scan" ? (
              <motion.div
                key="scan"
                className="vault-tab-panel"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                transition={{ duration: 0.25 }}
              >
                <div className="vault-scanner-panel">
                  <div id={scannerElementId} className="vault-scanner" />
                </div>
                <p className="vault-help-text">
                  Camera scan auto-fills the Batch ID field, then switch to "Enter Batch ID" to verify.
                </p>
                {scannerError && <p className="vault-inline-error">{scannerError}</p>}
              </motion.div>
            ) : (
              <motion.form
                key="manual"
                onSubmit={onVerifySubmit}
                className="vault-tab-panel"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.25 }}
              >
                <label className="vault-input-label" htmlFor="vault-batch-id">
                  Batch ID
                </label>
                <input
                  id="vault-batch-id"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && batchId.trim() && runVerify(batchId)}
                  placeholder="e.g. BATCH001"
                  className="vault-input"
                  autoComplete="off"
                />

                {/* Task 3 — quick-fill demo batch ID pills */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {["PCH-2024-001", "PCH-2024-002", "DEMO-BATCH-001"].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBatchId(id)}
                      className="text-xs text-gray-400 hover:text-[#00f5d4] border border-gray-700 hover:border-[#00f5d4]/50 px-2 py-1 rounded-md transition-colors"
                    >
                      {id}
                    </button>
                  ))}
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -1 }}
                  type="submit"
                  className="vault-verify-btn"
                  disabled={loading || !batchId.trim()}
                >
                  Verify Now
                </motion.button>

                {error && <p className="vault-inline-error">{error}</p>}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {result && verifyState && verifyState !== "COUNTERFEIT" && (
            <motion.div
              ref={resultCardRef}
              className={`vault-result-card ${verifyState.toLowerCase()}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="vault-result-header">
                <div>
                  <p className="vault-result-status">
                    {verifyState === "SAFE" ? "✅ SAFE" : "⚠️ WARNING"}
                  </p>
                  <h2>{result.data.drugName || "Unknown Drug"}</h2>
                  <p>{result.message}</p>
                  <p className="vault-help-text" style={{ marginTop: 6 }}>
                    Source: {verificationSource === "onchain" ? "Direct on-chain (wallet)" : "Backend API"}
                  </p>
                </div>
                <button
                  type="button"
                  className="vault-share-btn"
                  onClick={onShare}
                  disabled={sharing}
                >
                  {sharing ? "Generating..." : "Share Result"}
                </button>
              </div>

              <div className="vault-grid">
                <div>
                  <p className="vault-meta-label">Manufacturer</p>
                  {result.data.manufacturerName ? (
                    <>
                      <p>
                        {result.data.manufacturerName}
                        {result.data.isVerified && (
                          <span className="did-verified-badge">✓ Verified</span>
                        )}
                      </p>
                      {result.data.licenseId && (
                        <p className="did-license-id">License: {result.data.licenseId}</p>
                      )}
                    </>
                  ) : (
                    <p>{result.data.manufacturer || "Unknown"}</p>
                  )}
                </div>
                <div>
                  <p className="vault-meta-label">Expiry</p>
                  <p>
                    {result.data.expiryDate
                      ? new Date(result.data.expiryDate * 1000).toLocaleDateString()
                      : "Not available"}
                  </p>
                </div>
                <div>
                  <p className="vault-meta-label">Current Location</p>
                  <p>{timeline[timeline.length - 1]?.location ?? "In transit"}</p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  Blockchain Proof
                </p>
                <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Network</span>
                    <span className="text-[#00f5d4]">Sepolia Testnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Contract</span>
                    <span className="text-gray-300">
                      {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Batch record</span>
                    <span className="text-gray-300">On-chain ✓</span>
                  </div>
                  {/* Task 4 — scan timestamp row */}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Verified at</span>
                    <span className="text-gray-300">
                      {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <a
                    href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-[#00f5d4] hover:text-white border border-[#00f5d4]/30 hover:border-[#00f5d4] rounded-lg py-2 mt-2 transition-colors"
                  >
                    View contract on Etherscan →
                  </a>
                </div>
              </div>

              {verifyState === "WARNING" && warningFlags.length > 0 && (
                <div className="vault-warning-box">
                  {warningFlags.map((flag) => (
                    <div key={flag.label} className="vault-warning-item">
                      <p>{flag.label}</p>
                      <span>{flag.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="vault-timeline">
                {timeline.map((step, index) => (
                  <div className="vault-timeline-step" key={`${step.txHash}-${step.role}`}>
                    <div className="vault-timeline-dot" />
                    <div className="vault-timeline-content">
                      <div className="vault-step-topline">
                        <strong>{step.actor}</strong>
                        <span className={`vault-role-badge ${step.role.toLowerCase()}`}>{step.role}</span>
                      </div>
                      <p>{step.location}</p>
                      <div className="vault-step-bottomline">
                        <span>{new Date(step.timestamp).toLocaleString()}</span>
                        <a
                          href={`https://etherscan.io/tx/${step.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {formatHash(step.txHash)}
                        </a>
                      </div>
                    </div>
                    {index < timeline.length - 1 && <div className="vault-timeline-line" />}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SecurityAlert
          alertReason={result?.alertReason ?? null}
          scanCount={result?.scanCount ?? 0}
          expectedUnits={result?.expectedUnits ?? 0}
          previousScan={result?.previousScan ?? null}
          currentCity={result?.currentLocation?.city ?? ""}
          onReport={() => alert("Report submitted! Thank you for keeping medicines safe.")}
        />

        {result && riskScore && (
          <AIInsightsPanel
            riskScore={riskScore}
            status={result.status}
            scanCount={result.scanCount}
            expectedUnits={result.expectedUnits}
            alertReason={result.alertReason}
            drugName={result.data.drugName || "Unknown Drug"}
            manufacturer={result.data.manufacturer || "Unknown"}
            hasExpiry={!!result.data.expiryDate}
            city={result.currentLocation?.city}
          />
        )}
      </motion.div>

      <AnimatePresence>
        {loading && (
          <motion.div
            className="vault-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="vault-loading-shell"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <motion.div
                className="vault-chain-loader"
                animate={{ rotate: 360 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.2, ease: "linear" }}
              >
                <span />
                <span />
                <span />
                <span />
              </motion.div>
              <h3>Querying blockchain...</h3>
              <p>Unlocking vault proof and validating every transfer record.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && verifyState === "COUNTERFEIT" && (
          <motion.div
            className="vault-counterfeit-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="vault-counterfeit-card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <div className="vault-warning-icon">❌</div>
              <h2>COUNTERFEIT DETECTED</h2>
              <p>Do NOT consume. This batch cannot be validated on-chain.</p>
              <button
                type="button"
                className="vault-report-btn"
                onClick={() => window.open("mailto:alerts@pharmachain.org?subject=Counterfeit%20Batch%20Report", "_blank")}
              >
                Do NOT consume. Report immediately.
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

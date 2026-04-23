import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Proposal {
  proposalId: number;
  candidate: string;
  name: string;
  licenseId: string;
  voteCount: number;
  quorum: number;
  executed: boolean;
  status: "PENDING" | "APPROVED";
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function fetchProposals(): Promise<Proposal[]> {
  const res = await fetch(`${API_BASE}/api/proposals`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function VoteBar({ votes, quorum }: { votes: number; quorum: number }) {
  const pct = Math.min((votes / quorum) * 100, 100);
  const color = votes >= quorum ? "#4ade80" : votes === 0 ? "rgba(255,255,255,0.15)" : "#fbbf24";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 99,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{ height: "100%", borderRadius: 99, background: color }}
        />
      </div>
      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        {votes}/{quorum}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "APPROVED" }) {
  const approved = status === "APPROVED";
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "2px 10px",
        borderRadius: 9999,
        border: "1px solid",
        background: approved ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.1)",
        color: approved ? "#4ade80" : "#fbbf24",
        borderColor: approved ? "rgba(34,197,94,0.3)" : "rgba(251,191,36,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {approved ? "✓ Approved" : "⏳ Pending"}
    </span>
  );
}

export default function DAOPanel() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProposals()
      .then((data) => {
        setProposals(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const approved = proposals.filter((p) => p.executed).length;
  const pending = proposals.filter((p) => !p.executed).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      style={{
        marginTop: 24,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(13,17,23,0.6)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1rem" }}>🏛️</span>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
              Manufacturer Authorization DAO
            </span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Governance: <strong style={{ color: "var(--text-primary)" }}>3 of 5</strong> committee
            votes required to authorize a manufacturer
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <span
            style={{
              fontSize: "0.72rem", fontWeight: 700, padding: "3px 12px",
              borderRadius: 9999, border: "1px solid rgba(34,197,94,0.3)",
              background: "rgba(34,197,94,0.1)", color: "#4ade80",
            }}
          >
            {approved} Approved
          </span>
          {pending > 0 && (
            <span
              style={{
                fontSize: "0.72rem", fontWeight: 700, padding: "3px 12px",
                borderRadius: 9999, border: "1px solid rgba(251,191,36,0.25)",
                background: "rgba(251,191,36,0.1)", color: "#fbbf24",
              }}
            >
              {pending} Pending
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "0 0 4px" }}>
        {loading && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                style={{ height: 36, borderRadius: 8, background: "rgba(255,255,255,0.06)" }}
              />
            ))}
          </div>
        )}

        {error && !loading && (
          <p style={{ padding: 20, fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
            DAO data unavailable (backend offline).
          </p>
        )}

        {!loading && !error && proposals.length === 0 && (
          <p style={{ padding: 20, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            No proposals yet. Committee members can create one via{" "}
            <code style={{ fontSize: "0.75rem" }}>proposeManufacturer()</code>.
          </p>
        )}

        {!loading && proposals.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["#", "Manufacturer", "License ID", "Candidate", "Votes", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 16px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proposals.map((p, idx) => (
                  <motion.tr
                    key={p.proposalId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    style={{
                      borderBottom: idx < proposals.length - 1
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "none",
                    }}
                  >
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                      #{p.proposalId}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {p.name}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {p.licenseId}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {shortAddr(p.candidate)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <VoteBar votes={p.voteCount} quorum={p.quorum} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={p.status} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          padding: "10px 20px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          fontSize: "0.7rem",
          color: "rgba(255,255,255,0.2)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        <span>On-chain DAO · PillChain smart contract</span>
        <span>Read-only · Votes are cast via MetaMask</span>
      </div>
    </motion.div>
  );
}

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getTokenBalance } from "../lib/api";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [pillBalance, setPillBalance] = useState<number | null>(null);

  // Auto-detect already-connected MetaMask wallet
  useEffect(() => {
    const hydrate = async () => {
      try {
        const eth = (window as any).ethereum;
        if (!eth) return;
        const accounts: string[] = await eth.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          getTokenBalance(accounts[0])
            .then((b) => setPillBalance(b?.balance ?? null))
            .catch(() => {});
        }
      } catch {
        // silently ignore
      }
    };
    hydrate();

    // Re-hydrate on account change
    const eth = (window as any).ethereum;
    if (eth) {
      eth.on("accountsChanged", (accs: string[]) => {
        if (accs.length > 0) {
          setWalletAddress(accs[0]);
          getTokenBalance(accs[0]).then((b) => setPillBalance(b?.balance ?? null)).catch(() => {});
        } else {
          setWalletAddress(null);
          setPillBalance(null);
        }
      });
    }
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/verify" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <span className="navbar-brand-icon">💊</span>
          PillChain
        </NavLink>

        {/* Wallet + PILL balance badge */}
        {walletAddress && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: "0.72rem", marginLeft: "auto", marginRight: 12,
          }}>
            {pillBalance !== null && (
              <span style={{
                background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)",
                color: "#fbbf24", borderRadius: 20, padding: "3px 10px",
                fontWeight: 700, letterSpacing: "0.03em",
              }}>
                🪙 {pillBalance} PILL
              </span>
            )}
            <span style={{
              background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)",
              color: "#4ade80", borderRadius: 20, padding: "3px 10px",
              fontFamily: "monospace", fontWeight: 600,
            }}>
              ✅ {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          </div>
        )}

        <button
          className="navbar-hamburger"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <ul className={`navbar-links${menuOpen ? " open" : ""}`}>
          <li>
            <NavLink
              to="/verify"
              className={({ isActive }) => `navbar-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              🔍 Verify
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin"
              className={({ isActive }) => `navbar-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              🏛️ DAO
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `navbar-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              📊 Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/manufacturer"
              className={({ isActive }) => `navbar-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              📱 QR Generator
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/about"
              className={({ isActive }) => `navbar-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              ℹ️ About
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
}

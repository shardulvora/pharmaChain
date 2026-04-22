import { useState } from "react";
import { NavLink } from "react-router-dom";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <span className="navbar-brand-icon">💊</span>
          PillChain
        </NavLink>

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
              to="/"
              end
              className={({ isActive }) => `navbar-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              🔍 Verify
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
              to="/generate"
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

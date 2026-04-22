import { motion } from "framer-motion";

const steps = [
  {
    title: "Register",
    description:
      "Authorized pharmaceutical manufacturers register each drug batch on the Ethereum blockchain with a unique Batch ID, drug name, and expiry date.",
    icon: "📝",
  },
  {
    title: "Label",
    description:
      "A QR code containing the Batch ID is printed on the medicine packaging. This QR code links directly to the on-chain verification.",
    icon: "📦",
  },
  {
    title: "Verify",
    description:
      "Consumers scan the QR code or type the Batch ID. PillChain checks the blockchain in real-time and displays whether the drug is authentic, expired, or recalled.",
    icon: "✅",
  },
];

const techStack = [
  "Solidity",
  "Hardhat",
  "Ethereum",
  "FastAPI",
  "Python",
  "Web3.py",
  "React",
  "TypeScript",
  "Vite",
  "Framer Motion",
];

export default function AboutPage() {
  return (
    <div>
      <motion.div
        style={{ textAlign: "center", padding: "48px 0 16px" }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="section-eyebrow">How It Works</p>
        <h1 className="section-title">About PillChain</h1>
        <p className="section-subtitle" style={{ maxWidth: 600, margin: "0 auto" }}>
          PillChain is a blockchain-powered platform that combats counterfeit
          pharmaceuticals. Every drug batch is recorded on an immutable ledger,
          letting anyone verify authenticity in seconds.
        </p>
      </motion.div>

      <div className="about-grid">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            className="about-step"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * (i + 1) }}
          >
            <div className="about-step-number">{i + 1}</div>
            <h3>
              {step.icon} {step.title}
            </h3>
            <p>{step.description}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="glass-card"
        style={{ textAlign: "center", marginTop: 16 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: 8 }}>Why Blockchain?</h2>
        <p
          className="section-subtitle"
          style={{ maxWidth: 560, margin: "0 auto 24px" }}
        >
          Blockchain records are <strong>immutable</strong> — once a batch is
          registered, it cannot be altered or deleted. This guarantees that
          verification results are tamper-proof and trustworthy.
        </p>

        <h3
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          Technology Stack
        </h3>
        <div className="tech-badges">
          {techStack.map((tech) => (
            <span key={tech} className="tech-badge">
              {tech}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

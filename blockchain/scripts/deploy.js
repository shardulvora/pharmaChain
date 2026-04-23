// deploy.js — PillChain + PillToken (with DAO committee)
// Compatible with: Hardhat v3+ | Ethers.js v6
// Run: npx hardhat run scripts/deploy.js --network <localhost|sepolia>

"use strict";

const hre  = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ─── constants ────────────────────────────────────────────────────────────────

const ONE_YEAR_S              = 365 * 24 * 60 * 60;
const MANUFACTURER_NAME       = "Sun Pharma Ltd";
const MANUFACTURER_LICENSE_ID = "MFG-IN-2024-001";

const SEED_BATCHES = [
  { batchId: "BATCH001",       drugName: "Paracetamol 500mg",      manufacturer: "Sun Pharma" },
  { batchId: "BATCH002",       drugName: "Amoxicillin 250mg",      manufacturer: "Cipla Ltd" },
  { batchId: "BATCH003",       drugName: "Metformin 500mg",        manufacturer: "Dr. Reddys" },
  { batchId: "BATCH004",       drugName: "Ibuprofen 400mg",        manufacturer: "Abbott India" },
  { batchId: "BATCH005",       drugName: "Atorvastatin 10mg",      manufacturer: "Lupin Ltd" },
  { batchId: "BATCH006",       drugName: "Omeprazole 20mg",        manufacturer: "Torrent Pharma" },
  // BATCH007 — registered separately below with near-past expiry → shows as EXPIRED
  { batchId: "BATCH008",       drugName: "Pantoprazole 40mg",      manufacturer: "Alkem Laboratories" },
  { batchId: "BATCH009",       drugName: "Cetirizine 10mg",        manufacturer: "Zydus Lifesciences" },
  { batchId: "BATCH010",       drugName: "Amlodipine 5mg",         manufacturer: "Glenmark Pharmaceuticals" },
  { batchId: "BATCH011",       drugName: "Levothyroxine 50mcg",    manufacturer: "GSK India" },
  { batchId: "BATCH012",       drugName: "Losartan 50mg",          manufacturer: "Intas Pharmaceuticals" },
  // BATCH013 — registered separately below then revoked → shows as RECALLED
  { batchId: "PCH-2024-001",   drugName: "Amoxicillin 500mg",      manufacturer: "BioMed Labs" },
  { batchId: "PCH-2024-002",   drugName: "Ciprofloxacin 250mg",    manufacturer: "BioMed Labs" },
  { batchId: "DEMO-BATCH-001", drugName: "Demo Drug",              manufacturer: "Demo Manufacturer" },
];

// ─── DAO demo proposals (seeded for hackathon judges) ─────────────────────────
// These use the DAO proposal flow to showcase governance.
// Each proposal gets 3 votes from committee members 1-3 → auto-executes.
const DAO_DEMO_PROPOSALS = [
  {
    name:      "Cipla Ltd",
    licenseId: "MFG-IN-2024-002",
    // candidate will be committee[0] addr for demo purposes
  },
  {
    name:      "Dr. Reddys Laboratories",
    licenseId: "MFG-IN-2024-003",
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function explorerBaseFor(networkName) {
  switch (networkName) {
    case "sepolia":  return "https://sepolia.etherscan.io";
    case "mainnet":  return "https://etherscan.io";
    default:         return null;
  }
}

function resolvedChainId(networkName, configChainId) {
  if (configChainId != null) return configChainId;
  if (networkName === "sepolia")   return 11155111;
  if (networkName === "localhost") return 31337;
  if (networkName === "hardhat")   return 31337;
  return 0;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Signers ────────────────────────────────────────────────────────────
  // On localhost Hardhat gives 20 unlocked accounts — use accounts[1-5] as the
  // 5-member DAO committee so the deployer (owner) is separate from the DAO.
  // On Sepolia there is only one funded signer, so we reuse it for all roles.
  const signers        = await hre.ethers.getSigners();
  const deployer       = signers[0];
  const deployerAddress = await deployer.getAddress();

  const networkName  = hre.network.name;
  const chainId      = resolvedChainId(networkName, hre.network.config.chainId);
  const explorerBase = explorerBaseFor(networkName);
  const isLocalhost  = networkName === "localhost" || networkName === "hardhat";

  // On Sepolia, reuse deployer for all 5 committee slots.
  let committeeAddrs;
  let committeeSigners;
  if (isLocalhost && signers.length >= 6) {
    committeeSigners = signers.slice(1, 6);   // accounts[1..5]
    committeeAddrs   = await Promise.all(committeeSigners.map((s) => s.getAddress()));
  } else {
    // Single-key fallback: deployer fills all 5 committee slots.
    committeeAddrs   = Array(5).fill(deployerAddress);
    committeeSigners = Array(5).fill(deployer);
    console.log("⚠️  Single-key mode: deployer acts as all 5 committee members.");
  }

  console.log("━".repeat(60));
  console.log("  Network    :", networkName, `(chainId ${chainId})`);
  console.log("  Deployer   :", deployerAddress);
  console.log("  Committee  :", committeeAddrs.join("\n              "));
  console.log("━".repeat(60));

  // ── 2. Deploy PillToken ───────────────────────────────────────────────────
  console.log("\n⏳ Deploying PillToken (PILL)…");
  const PillToken  = await hre.ethers.getContractFactory("PillToken");
  const pillToken  = await PillToken.deploy();
  await pillToken.waitForDeployment();
  const pillTokenAddress = await pillToken.getAddress();
  console.log("✅ PillToken deployed to:", pillTokenAddress);

  // ── 3. Deploy PillChain with committee ────────────────────────────────────
  console.log("\n⏳ Deploying PillChain (DAO: 3-of-5)…");
  const PillChain  = await hre.ethers.getContractFactory("PillChain");
  const pillchain  = await PillChain.deploy(committeeAddrs);
  await pillchain.waitForDeployment();
  const pillChainAddress = await pillchain.getAddress();
  console.log("✅ PillChain deployed to:", pillChainAddress);

  // ── 4. Wire contracts ─────────────────────────────────────────────────────
  console.log("\n⏳ Linking contracts…");
  await (await pillToken.setPillChainContract(pillChainAddress)).wait();
  console.log("✅ PillToken.setPillChainContract →", pillChainAddress);
  await (await pillchain.setPillToken(pillTokenAddress)).wait();
  console.log("✅ PillChain.setPillToken →", pillTokenAddress);

  // ── 5. Seed manufacturer via owner (direct path — for demo data only) ─────
  // In production, use the DAO proposal flow (proposeManufacturer + voteOnProposal).
  console.log("\n⏳ Authorizing deployer as manufacturer (owner fast-path)…");
  await (await pillchain.authorizeManufacturerDirect(
    deployerAddress, MANUFACTURER_NAME, MANUFACTURER_LICENSE_ID
  )).wait();
  console.log(`✅ Direct-auth: ${deployerAddress} (${MANUFACTURER_NAME})`);

  // ── 6. Seed DAO demo proposals ────────────────────────────────────────────
  console.log("\n⏳ Seeding DAO demo proposals…");
  for (const [i, demo] of DAO_DEMO_PROPOSALS.entries()) {
    // Use a committee address as the "candidate" for demo purposes.
    const candidate = committeeAddrs[i % committeeAddrs.length];

    // committee[0] proposes
    const proposerContract = pillchain.connect(committeeSigners[0]);
    const proposeTx = await proposerContract.proposeManufacturer(
      candidate, demo.name, demo.licenseId
    );
    const receipt  = await proposeTx.wait();
    const log      = receipt.logs.find(
      (l) => pillchain.interface.parseLog(l)?.name === "ProposalCreated"
    );
    const proposalId = pillchain.interface.parseLog(log)?.args?.[0] ?? BigInt(i);

    console.log(`  📋 Proposal #${proposalId}: ${demo.name}`);

    // committee[0], [1], [2] vote → reaches quorum (3) → auto-executes
    for (let v = 0; v < 3; v++) {
      const voterContract = pillchain.connect(committeeSigners[v]);
      await (await voterContract.voteOnProposal(proposalId)).wait();
      console.log(`     ✓ Vote ${v + 1}/3 by committee[${v}]`);
    }
    console.log(`  ✅ Proposal #${proposalId} executed — ${demo.name} authorized`);
  }

  // ── 7. Seed batches ───────────────────────────────────────────────────────
  const expiryDate    = Math.floor(Date.now() / 1000) + ONE_YEAR_S;

  console.log(`\n── Seeding ${SEED_BATCHES.length + 2} batches ─────────────────────────────`);
  for (const batch of SEED_BATCHES) {
    const tx = await pillchain.registerBatch(
      batch.batchId, batch.drugName, batch.manufacturer, expiryDate
    );
    await tx.wait();
    console.log(`  📦 ${batch.batchId.padEnd(16)} ${batch.drugName}`);
  }

  // BATCH007 — short expiry demo.
  // IMPORTANT: Use chain time + buffer (not Date.now + a few seconds), otherwise
  // this can revert with "expiry in the past" after many preceding txs.
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const chainNow = Number(latestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
  const nearFutureExpiry = chainNow + 900; // 15-minute safety buffer
  const tx7 = await pillchain.registerBatch(
    "BATCH007", "Azithromycin 500mg", "Macleods Pharma", nearFutureExpiry
  );
  await tx7.wait();
  console.log(`  📦 BATCH007          Azithromycin 500mg (short-expiry demo)`);

  // BATCH013 — register then immediately revoke so it shows as RECALLED
  const tx13 = await pillchain.registerBatch(
    "BATCH013", "Diclofenac 50mg", "Novartis India", expiryDate
  );
  await tx13.wait();
  const revokeTx = await pillchain.revokeBatch("BATCH013");
  await revokeTx.wait();
  console.log(`  📦 BATCH013          Diclofenac 50mg → RECALLED (revoked for demo)`);

  // ── 8. Write deployedAddress.json ────────────────────────────────────────
  const pillChainArtifact = await hre.artifacts.readArtifact("PillChain");
  const pillTokenArtifact = await hre.artifacts.readArtifact("PillToken");

  const deployedInfo = {
    address:              pillChainAddress,
    abi:                  pillChainArtifact.abi,
    pillTokenAddress,
    pillTokenAbi:         pillTokenArtifact.abi,
    committee:            committeeAddrs,
    network:              networkName,
    chainId,
    deployedAt:           new Date().toISOString(),
    explorerUrl:          explorerBase ? `${explorerBase}/address/${pillChainAddress}` : null,
    pillTokenExplorerUrl: explorerBase ? `${explorerBase}/address/${pillTokenAddress}` : null,
  };

  const outPath = path.join(__dirname, "..", "deployedAddress.json");
  fs.writeFileSync(outPath, JSON.stringify(deployedInfo, null, 2));
  console.log("\n✅ deployedAddress.json →", outPath);

  // ── 9. Write seededBatches.json ──────────────────────────────────────────
  const seededPath = path.join(__dirname, "..", "seededBatches.json");
  fs.writeFileSync(seededPath, JSON.stringify({
    deployedAt: new Date().toISOString(),
    batches: SEED_BATCHES.map((b) => ({
      batchId:      b.batchId,
      drugName:     b.drugName,
      manufacturer: b.manufacturer,
      expiryDate,
    })),
  }, null, 2));
  console.log("✅ seededBatches.json →", seededPath);

  // ── 10. Auto-patch frontend/.env ─────────────────────────────────────────
  // This ensures VITE_CONTRACT_ADDRESS always matches the just-deployed
  // contract. Without this, the frontend talks to the old (now empty) address
  // after every Hardhat restart + redeploy.
  const frontendEnvPath = path.join(__dirname, "..", "..", "frontend", ".env");
  if (fs.existsSync(frontendEnvPath)) {
    let envContent = fs.readFileSync(frontendEnvPath, "utf8");

    // Update or insert VITE_CONTRACT_ADDRESS
    if (/^VITE_CONTRACT_ADDRESS=.*/m.test(envContent)) {
      envContent = envContent.replace(
        /^VITE_CONTRACT_ADDRESS=.*/m,
        `VITE_CONTRACT_ADDRESS=${pillChainAddress}`
      );
    } else {
      envContent += `\nVITE_CONTRACT_ADDRESS=${pillChainAddress}`;
    }

    // Update or insert VITE_TOKEN_ADDRESS
    if (/^VITE_TOKEN_ADDRESS=.*/m.test(envContent)) {
      envContent = envContent.replace(
        /^VITE_TOKEN_ADDRESS=.*/m,
        `VITE_TOKEN_ADDRESS=${pillTokenAddress}`
      );
    } else {
      envContent += `\nVITE_TOKEN_ADDRESS=${pillTokenAddress}`;
    }

    // Update explorer URL (localhost for Hardhat, Etherscan for Sepolia)
    const explorerUrl = explorerBase || "http://localhost:8545";
    if (/^VITE_EXPLORER_URL=.*/m.test(envContent)) {
      envContent = envContent.replace(
        /^VITE_EXPLORER_URL=.*/m,
        `VITE_EXPLORER_URL=${explorerUrl}`
      );
    } else {
      envContent += `\nVITE_EXPLORER_URL=${explorerUrl}`;
    }

    fs.writeFileSync(frontendEnvPath, envContent);
    console.log("✅ frontend/.env patched automatically");
    console.log("   VITE_CONTRACT_ADDRESS =", pillChainAddress);
    console.log("   VITE_TOKEN_ADDRESS    =", pillTokenAddress);
  } else {
    // frontend/.env doesn't exist yet — create it
    fs.writeFileSync(
      frontendEnvPath,
      [
        `VITE_API_BASE_URL=http://127.0.0.1:8000`,
        `VITE_CONTRACT_ADDRESS=${pillChainAddress}`,
        `VITE_TOKEN_ADDRESS=${pillTokenAddress}`,
        `VITE_EXPLORER_URL=${explorerBase || "http://localhost:8545"}`,
      ].join("\n") + "\n"
    );
    console.log("✅ frontend/.env created");
  }

  // ── 11. Summary ───────────────────────────────────────────────────────────
  console.log("\n" + "━".repeat(60));
  console.log("  PillChain  :", pillChainAddress);
  console.log("  PillToken  :", pillTokenAddress);
  console.log("  Committee  :", committeeAddrs[0], "(+ 4 more)");
  if (explorerBase) {
    console.log("  Etherscan  :", `${explorerBase}/address/${pillChainAddress}`);
    console.log("  PILL token :", `${explorerBase}/address/${pillTokenAddress}`);
  }
  console.log("  Network    :", networkName, `(chainId ${chainId})`);
  console.log("━".repeat(60));
  console.log("\n🎉 Done! Restart your frontend dev server to pick up the new contract address.");
}

// ─── entry point ──────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\n❌ Deploy failed:", err.message ?? err);
  process.exitCode = 1;
});

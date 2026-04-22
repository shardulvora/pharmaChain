const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [owner, manufacturer] = await hre.ethers.getSigners();

  console.log("Deploying PillChain with owner:", owner.address);
  console.log("Manufacturer signer:", manufacturer.address);

  // ── 1. Deploy ──────────────────────────────────────────────
  const PillChain = await hre.ethers.getContractFactory("PillChain");
  const pillchain = await PillChain.deploy();
  await pillchain.waitForDeployment();

  const deployedAddress = await pillchain.getAddress();
  console.log("\n✅ PillChain deployed to:", deployedAddress);

  // ── 2. Authorize manufacturer ──────────────────────────────
  const authTx = await pillchain.authorizeManufacturer(manufacturer.address);
  await authTx.wait();
  console.log("✅ Manufacturer authorized:", manufacturer.address);

  // ── 3. Seed test batches ───────────────────────────────────
  const ONE_YEAR = 365 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const expiryOneYear = now + ONE_YEAR;

  const testBatches = [
    {
      batchId: "BATCH001",
      drugName: "Paracetamol 500mg",
      manufacturer: "Sun Pharma",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH002",
      drugName: "Amoxicillin 250mg",
      manufacturer: "Cipla Ltd",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH003",
      drugName: "Metformin 500mg",
      manufacturer: "Dr. Reddys",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH004",
      drugName: "Ibuprofen 400mg",
      manufacturer: "Abbott India",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH005",
      drugName: "Atorvastatin 10mg",
      manufacturer: "Lupin Ltd",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH006",
      drugName: "Omeprazole 20mg",
      manufacturer: "Torrent Pharma",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH007",
      drugName: "Azithromycin 500mg",
      manufacturer: "Macleods Pharma",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH008",
      drugName: "Pantoprazole 40mg",
      manufacturer: "Alkem Laboratories",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH009",
      drugName: "Cetirizine 10mg",
      manufacturer: "Zydus Lifesciences",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH010",
      drugName: "Amlodipine 5mg",
      manufacturer: "Glenmark Pharmaceuticals",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH011",
      drugName: "Levothyroxine 50mcg",
      manufacturer: "GSK India",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH012",
      drugName: "Losartan 50mg",
      manufacturer: "Intas Pharmaceuticals",
      expiryDate: expiryOneYear,
    },
    {
      batchId: "BATCH013",
      drugName: "Diclofenac 50mg",
      manufacturer: "Novartis India",
      expiryDate: expiryOneYear,
    },
  ];

  // Connect contract as manufacturer to register batches
  const pillchainAsMfg = pillchain.connect(manufacturer);

  console.log("\n── Seeded Batches ─────────────────────────────");
  for (const batch of testBatches) {
    const tx = await pillchainAsMfg.registerBatch(
      batch.batchId,
      batch.drugName,
      batch.manufacturer,
      batch.expiryDate
    );
    await tx.wait();
    console.log(
      `  📦 ${batch.batchId} | ${batch.drugName} | ${batch.manufacturer} | expires ${new Date(batch.expiryDate * 1000).toISOString()}`
    );
  }

  // ── 4. Write deployedAddress.json ──────────────────────────
  const artifact = await hre.artifacts.readArtifact("PillChain");

  const output = {
    address: deployedAddress,
    abi: artifact.abi,
    network: hre.network.name,
  };

  const outPath = path.join(__dirname, "..", "deployedAddress.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log("\n✅ deployedAddress.json written to:", outPath);

  // ── 5. Write seededBatches.json ────────────────────────────
  const seededOutput = {
    batches: testBatches.map((b) => ({
      batchId: b.batchId,
      drugName: b.drugName,
      manufacturer: b.manufacturer,
      expiryDate: b.expiryDate,
    })),
    deployedAt: new Date().toISOString(),
  };

  const seededPath = path.join(__dirname, "..", "seededBatches.json");
  fs.writeFileSync(seededPath, JSON.stringify(seededOutput, null, 2));
  console.log("✅ seededBatches.json written to:", seededPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const { expect } = require("chai");
const hre = require("hardhat");

describe("PillChain", function () {
  let pillchain;
  let owner, manufacturer, manufacturer2, unauthorized;

  // Expiry date = 1 year in the future
  const ONE_YEAR = 365 * 24 * 60 * 60;
  let futureExpiry;

  // DID identity for manufacturer
  const MFG_NAME = "Sun Pharma Ltd";
  const MFG_LICENSE = "MFG-IN-2024-001";

  beforeEach(async function () {
    [owner, manufacturer, manufacturer2, unauthorized] = await hre.ethers.getSigners();

    const PillChain = await hre.ethers.getContractFactory("PillChain");
    pillchain = await PillChain.deploy();
    await pillchain.waitForDeployment();

    // Calculate a future expiry based on the latest block timestamp
    const block = await hre.ethers.provider.getBlock("latest");
    futureExpiry = block.timestamp + ONE_YEAR;
  });

  // ── Authorization / DID Tests ─────────────────────────────

  it("Owner can authorize a manufacturer with name and licenseId", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    const [name, licenseId, isVerified] = await pillchain.getManufacturer(manufacturer.address);
    expect(name).to.equal(MFG_NAME);
    expect(licenseId).to.equal(MFG_LICENSE);
    expect(isVerified).to.be.true;
  });

  it("Owner can revoke a manufacturer (isVerified becomes false, identity preserved)", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain.revokeManufacturer(manufacturer.address);

    const [name, licenseId, isVerified] = await pillchain.getManufacturer(manufacturer.address);
    // Name and licenseId are preserved for audit trail
    expect(name).to.equal(MFG_NAME);
    expect(licenseId).to.equal(MFG_LICENSE);
    expect(isVerified).to.be.false;
  });

  it("Non-owner cannot authorize a manufacturer", async function () {
    await expect(
      pillchain.connect(unauthorized).authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE)
    ).to.be.revertedWith("PillChain: caller is not owner");
  });

  it("Non-owner cannot revoke a manufacturer", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);
    await expect(
      pillchain.connect(unauthorized).revokeManufacturer(manufacturer.address)
    ).to.be.revertedWith("PillChain: caller is not owner");
  });

  it("authorizeManufacturer rejects empty name", async function () {
    await expect(
      pillchain.authorizeManufacturer(manufacturer.address, "", MFG_LICENSE)
    ).to.be.revertedWith("PillChain: name cannot be empty");
  });

  it("authorizeManufacturer rejects empty licenseId", async function () {
    await expect(
      pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, "")
    ).to.be.revertedWith("PillChain: licenseId cannot be empty");
  });

  it("getManufacturer returns empty for unknown address", async function () {
    const [name, licenseId, isVerified] = await pillchain.getManufacturer(unauthorized.address);
    expect(name).to.equal("");
    expect(licenseId).to.equal("");
    expect(isVerified).to.be.false;
  });

  // ── Ownership Tests ───────────────────────────────────────

  it("Owner can transfer ownership", async function () {
    await pillchain.transferOwnership(manufacturer.address);
    expect(await pillchain.owner()).to.equal(manufacturer.address);
  });

  it("Non-owner cannot transfer ownership", async function () {
    await expect(
      pillchain.connect(unauthorized).transferOwnership(unauthorized.address)
    ).to.be.revertedWith("PillChain: caller is not owner");
  });

  it("Cannot transfer ownership to zero address", async function () {
    await expect(
      pillchain.transferOwnership(hre.ethers.ZeroAddress)
    ).to.be.revertedWith("PillChain: zero address not allowed");
  });

  // ── Batch Registration Tests ──────────────────────────────

  it("Authorized manufacturer can register a batch", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);

    const [isAuthentic] = await pillchain.verifyBatch("BATCH001");
    expect(isAuthentic).to.be.true;
  });

  it("Unauthorized address cannot register a batch", async function () {
    await expect(
      pillchain
        .connect(unauthorized)
        .registerBatch("BATCH999", "FakeDrug", "FakeCo", futureExpiry)
    ).to.be.revertedWith("PillChain: caller is not an authorized manufacturer");
  });

  it("Duplicate batchId registration reverts", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);

    await expect(
      pillchain
        .connect(manufacturer)
        .registerBatch("BATCH001", "Duplicate", "DupCo", futureExpiry)
    ).to.be.revertedWith("PillChain: batch already exists");
  });

  it("Revoked manufacturer cannot register new batches", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);
    await pillchain.revokeManufacturer(manufacturer.address);

    await expect(
      pillchain
        .connect(manufacturer)
        .registerBatch("BATCH999", "SomeDrug", MFG_NAME, futureExpiry)
    ).to.be.revertedWith("PillChain: caller is not an authorized manufacturer");
  });

  // ── Verification Tests ────────────────────────────────────

  it("verifyBatch returns isAuthentic=true for a registered batch", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);

    const [isAuthentic, isExpired, isRevoked, batch] =
      await pillchain.verifyBatch("BATCH001");

    expect(isAuthentic).to.be.true;
    expect(isExpired).to.be.false;
    expect(isRevoked).to.be.false;
    expect(batch.drugName).to.equal("Paracetamol 500mg");
    expect(batch.manufacturer).to.equal(MFG_NAME);
    expect(batch.registeredBy).to.equal(manufacturer.address);
  });

  it("verifyBatch returns isAuthentic=false for unknown batchId", async function () {
    const [isAuthentic] = await pillchain.verifyBatch("DOESNOTEXIST");
    expect(isAuthentic).to.be.false;
  });

  // ── Revoke Tests ──────────────────────────────────────────

  it("Batch registerer can revoke their own batch", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);

    await pillchain.connect(manufacturer).revokeBatch("BATCH001");

    const [isAuthentic, , isRevoked] = await pillchain.verifyBatch("BATCH001");
    expect(isAuthentic).to.be.true;
    expect(isRevoked).to.be.true;
  });

  it("Different manufacturer cannot revoke another's batch", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);
    await pillchain.authorizeManufacturer(manufacturer2.address, "Cipla Ltd", "MFG-IN-2024-002");

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);

    await expect(
      pillchain.connect(manufacturer2).revokeBatch("BATCH001")
    ).to.be.revertedWith("PillChain: only the batch registerer can revoke");
  });

  // ── Enumeration Tests ─────────────────────────────────────

  it("getBatchCount returns correct count", async function () {
    expect(await pillchain.getBatchCount()).to.equal(0);

    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);

    expect(await pillchain.getBatchCount()).to.equal(1);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH002", "Amoxicillin 250mg", "Cipla Ltd", futureExpiry);

    expect(await pillchain.getBatchCount()).to.equal(2);
  });

  it("getBatchIdAtIndex returns correct batch IDs", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);
    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH002", "Amoxicillin 250mg", "Cipla Ltd", futureExpiry);

    expect(await pillchain.getBatchIdAtIndex(0)).to.equal("BATCH001");
    expect(await pillchain.getBatchIdAtIndex(1)).to.equal("BATCH002");
  });

  it("getBatchIdAtIndex reverts for out-of-bounds index", async function () {
    await expect(
      pillchain.getBatchIdAtIndex(0)
    ).to.be.revertedWith("PillChain: index out of bounds");
  });

  it("getAllBatchIds returns full array", async function () {
    await pillchain.authorizeManufacturer(manufacturer.address, MFG_NAME, MFG_LICENSE);

    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH001", "Paracetamol 500mg", MFG_NAME, futureExpiry);
    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH002", "Amoxicillin 250mg", "Cipla Ltd", futureExpiry);
    await pillchain
      .connect(manufacturer)
      .registerBatch("BATCH003", "Metformin 500mg", "Dr. Reddys", futureExpiry);

    const allIds = await pillchain.getAllBatchIds();
    expect(allIds).to.deep.equal(["BATCH001", "BATCH002", "BATCH003"]);
  });
});

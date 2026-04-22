// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PillChain
 * @notice Fake drug detection & pharmaceutical supply chain verification.
 *         Manufacturers register drug batches on-chain; anyone can verify
 *         authenticity by batch ID.
 *
 *         DID extension: each authorized manufacturer now carries a real-world
 *         name and a regulatory license ID stored on-chain, giving human-readable
 *         identity without any external DID framework.
 */
contract PillChain {
    // ──────────────────────────  Types  ──────────────────────────

    struct DrugBatch {
        string     batchId;
        string     drugName;
        string     manufacturer;
        uint256    expiryDate;      // unix timestamp
        address    registeredBy;    // wallet that registered the batch
        bool       isRevoked;
        bool       exists;          // true once registered
    }

    /// @notice On-chain identity record for a manufacturer.
    struct Manufacturer {
        string name;        // e.g. "Sun Pharma Ltd"
        string licenseId;   // e.g. "MFG-IN-2024-001"
        bool   isVerified;  // true when authorized by contract owner
    }

    // ──────────────────────────  State  ──────────────────────────

    address public owner;

    /// batchId → DrugBatch
    mapping(string => DrugBatch) private batches;

    /// ordered list of every registered batchId
    string[] private batchIds;

    /// address → Manufacturer identity (replaces plain bool mapping)
    mapping(address => Manufacturer) public manufacturers;

    // ─────────────────────────  Events  ─────────────────────────

    event ManufacturerAuthorized(address indexed manufacturer, string name, string licenseId);
    event ManufacturerRevoked(address indexed manufacturer);
    event BatchRegistered(
        string indexed batchId,
        string drugName,
        string manufacturer,
        uint256 expiryDate
    );
    event BatchRevoked(string indexed batchId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ────────────────────────  Modifiers  ───────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "PillChain: caller is not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            manufacturers[msg.sender].isVerified,
            "PillChain: caller is not an authorized manufacturer"
        );
        _;
    }

    // ───────────────────────  Constructor  ──────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ──────────────────────  Owner Functions  ───────────────────

    /**
     * @notice Authorize an address to register drug batches, recording their
     *         real-world name and regulatory license ID on-chain.
     * @param addr      The manufacturer wallet address.
     * @param name      Human-readable company name.
     * @param licenseId Regulatory / DID license identifier.
     */
    function authorizeManufacturer(
        address addr,
        string memory name,
        string memory licenseId
    ) external onlyOwner {
        require(addr != address(0), "PillChain: zero address not allowed");
        require(bytes(name).length > 0, "PillChain: name cannot be empty");
        require(bytes(licenseId).length > 0, "PillChain: licenseId cannot be empty");

        manufacturers[addr] = Manufacturer({
            name:       name,
            licenseId:  licenseId,
            isVerified: true
        });

        emit ManufacturerAuthorized(addr, name, licenseId);
    }

    /**
     * @notice Revoke authorization from a manufacturer.
     * @param addr The address to deauthorize.
     */
    function revokeManufacturer(address addr) external onlyOwner {
        require(addr != address(0), "PillChain: zero address not allowed");
        manufacturers[addr].isVerified = false;
        emit ManufacturerRevoked(addr);
    }

    /**
     * @notice Transfer contract ownership to a new address.
     * @param _newOwner The address to transfer ownership to.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "PillChain: zero address not allowed");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    // ────────────────────  Manufacturer Functions  ──────────────

    /**
     * @notice Register a new drug batch on-chain.
     * @param _batchId     Unique identifier printed on the medicine box.
     * @param _drugName    Human-readable drug name + strength.
     * @param _manufacturer Name of the pharmaceutical company.
     * @param _expiryDate  Unix timestamp of the expiry date.
     */
    function registerBatch(
        string memory _batchId,
        string memory _drugName,
        string memory _manufacturer,
        uint256 _expiryDate
    ) external onlyAuthorized {
        require(!batches[_batchId].exists, "PillChain: batch already exists");
        require(_expiryDate > block.timestamp, "PillChain: expiry in the past");

        batches[_batchId] = DrugBatch({
            batchId:      _batchId,
            drugName:     _drugName,
            manufacturer: _manufacturer,
            expiryDate:   _expiryDate,
            registeredBy: msg.sender,
            isRevoked:    false,
            exists:       true
        });

        batchIds.push(_batchId);

        emit BatchRegistered(_batchId, _drugName, _manufacturer, _expiryDate);
    }

    /**
     * @notice Revoke / recall a drug batch. Only the original registerer can revoke.
     * @param _batchId The batch to revoke.
     */
    function revokeBatch(string memory _batchId) external onlyAuthorized {
        require(batches[_batchId].exists, "PillChain: batch does not exist");
        require(
            batches[_batchId].registeredBy == msg.sender,
            "PillChain: only the batch registerer can revoke"
        );
        batches[_batchId].isRevoked = true;
        emit BatchRevoked(_batchId);
    }

    // ─────────────────────  Public View  ────────────────────────

    /**
     * @notice Verify a drug batch by its ID.
     * @param _batchId The batch identifier from the QR code.
     * @return isAuthentic  True if the batch exists on-chain.
     * @return isExpired    True if block.timestamp > expiryDate.
     * @return isRevoked    True if the batch has been recalled.
     * @return batch        The full DrugBatch struct.
     */
    function verifyBatch(
        string memory _batchId
    )
        external
        view
        returns (
            bool isAuthentic,
            bool isExpired,
            bool isRevoked,
            DrugBatch memory batch
        )
    {
        DrugBatch memory b = batches[_batchId];

        if (!b.exists) {
            // batch not found → not authentic
            return (false, false, false, b);
        }

        isAuthentic = true;
        isExpired   = block.timestamp > b.expiryDate;
        isRevoked   = b.isRevoked;
        batch       = b;
    }

    /**
     * @notice Look up the DID identity of a manufacturer by wallet address.
     * @param addr The manufacturer wallet address.
     * @return name       Company name.
     * @return licenseId  Regulatory license ID.
     * @return isVerified Whether this address is currently authorized.
     */
    function getManufacturer(address addr)
        external
        view
        returns (
            string memory name,
            string memory licenseId,
            bool isVerified
        )
    {
        Manufacturer memory m = manufacturers[addr];
        return (m.name, m.licenseId, m.isVerified);
    }

    /**
     * @notice Get the total number of registered batches.
     */
    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }

    /**
     * @notice Get a batch ID by its index in the registry.
     * @param _index The zero-based index.
     */
    function getBatchIdAtIndex(uint256 _index) external view returns (string memory) {
        require(_index < batchIds.length, "PillChain: index out of bounds");
        return batchIds[_index];
    }

    /**
     * @notice Get all registered batch IDs.
     * @dev May be expensive for very large registries.
     */
    function getAllBatchIds() external view returns (string[] memory) {
        return batchIds;
    }
}

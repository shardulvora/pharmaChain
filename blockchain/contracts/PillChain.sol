// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PillToken.sol";

/**
 * @title PillChain
 * @notice Fake drug detection & pharmaceutical supply chain verification.
 *
 *         DID extension: each authorized manufacturer carries a real-world
 *         name and regulatory license ID stored on-chain.
 *
 *         Token incentive: integrates PillToken (ERC-20) to reward community
 *         members who report counterfeits and verify drug batches.
 *
 *         DAO governance: manufacturer authorization is governed by a 5-member
 *         committee.  A proposal passes when QUORUM (3) members vote for it —
 *         no single party controls who can register drugs.
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
        bool   isVerified;  // true when authorized by DAO vote or owner
    }

    /**
     * @notice DAO proposal to authorize a new manufacturer.
     * @dev    The hasVoted mapping inside the struct prevents
     *         the same committee member from voting twice per proposal.
     */
    struct AuthProposal {
        address candidate;
        string  name;
        string  licenseId;
        uint256 voteCount;
        bool    executed;
        mapping(address => bool) hasVoted;
    }

    // ──────────────────────────  State  ──────────────────────────

    address public owner;

    /// DAO governance — exactly 5 committee members, 3-of-5 quorum.
    address[] public committee;
    uint256   public constant QUORUM = 3;

    /// PillToken contract for community reward payouts.
    PillToken public pillToken;

    /// batchId → DrugBatch
    mapping(string => DrugBatch) private batches;

    /// ordered list of every registered batchId
    string[] private batchIds;

    /// address → Manufacturer identity
    mapping(address => Manufacturer) public manufacturers;

    /// DAO proposals
    mapping(uint256 => AuthProposal) public proposals;
    uint256 public proposalCount;

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
    event CounterfeitReported(string indexed batchId, address indexed reporter, uint256 timestamp);

    // ─── DAO events ──────────────────────────────────────────────
    event ProposalCreated(uint256 indexed proposalId, address indexed candidate, string name);
    event Voted(uint256 indexed proposalId, address indexed voter);
    event ProposalExecuted(uint256 indexed proposalId, address indexed manufacturer);

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

    /// @dev Checks membership by linear scan (committee is fixed at 5 members).
    modifier onlyCommittee() {
        bool isMember = false;
        for (uint256 i = 0; i < committee.length; i++) {
            if (committee[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "PillChain: caller is not a committee member");
        _;
    }

    // ───────────────────────  Constructor  ──────────────────────

    /**
     * @param _committee Exactly 5 addresses forming the authorization committee.
     */
    constructor(address[] memory _committee) {
        require(_committee.length == 5, "PillChain: need exactly 5 committee members");
        owner     = msg.sender;
        committee = _committee;
    }

    // ──────────────────────  Owner Functions  ───────────────────

    /**
     * @notice Direct (owner-only) manufacturer authorization.
     *         Used for seeding demo data during deployment.
     *         In production use the DAO proposal flow instead.
     */
    function authorizeManufacturerDirect(
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
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "PillChain: zero address not allowed");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @notice Link the PillToken ERC-20 contract so verified reports are rewarded.
     */
    function setPillToken(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "PillChain: zero address not allowed");
        pillToken = PillToken(_tokenAddress);
    }

    // ─────────────────────  DAO Functions  ──────────────────────

    /**
     * @notice Create a DAO proposal to authorize a new manufacturer.
     *         Any committee member can propose; the proposer's vote is NOT
     *         automatically counted — they must call voteOnProposal separately.
     * @return proposalId The ID of the created proposal.
     */
    function proposeManufacturer(
        address _candidate,
        string memory _name,
        string memory _licenseId
    ) external onlyCommittee returns (uint256) {
        require(_candidate != address(0), "PillChain: zero address not allowed");
        require(bytes(_name).length > 0, "PillChain: name cannot be empty");
        require(bytes(_licenseId).length > 0, "PillChain: licenseId cannot be empty");

        uint256 id = proposalCount++;
        AuthProposal storage p = proposals[id];
        p.candidate = _candidate;
        p.name      = _name;
        p.licenseId = _licenseId;
        // voteCount and executed default to 0 / false

        emit ProposalCreated(id, _candidate, _name);
        return id;
    }

    /**
     * @notice Cast a vote on an existing proposal.
     *         When QUORUM is reached the manufacturer is authorized automatically.
     * @param _proposalId The ID of the proposal to vote on.
     */
    function voteOnProposal(uint256 _proposalId) external onlyCommittee {
        require(_proposalId < proposalCount, "PillChain: proposal does not exist");
        AuthProposal storage p = proposals[_proposalId];

        require(!p.executed,               "PillChain: proposal already executed");
        require(!p.hasVoted[msg.sender],   "PillChain: already voted");

        p.hasVoted[msg.sender] = true;
        p.voteCount++;
        emit Voted(_proposalId, msg.sender);

        // Auto-execute once quorum is reached.
        if (p.voteCount >= QUORUM) {
            p.executed = true;
            manufacturers[p.candidate] = Manufacturer({
                name:       p.name,
                licenseId:  p.licenseId,
                isVerified: true
            });
            emit ManufacturerAuthorized(p.candidate, p.name, p.licenseId);
            emit ProposalExecuted(_proposalId, p.candidate);
        }
    }

    /**
     * @notice Read a proposal's public fields.
     * @dev    hasVoted is not returned — callers can check specific addresses
     *         via hasVotedOn().
     */
    function getProposal(uint256 _proposalId)
        external
        view
        returns (
            address candidate,
            string memory name,
            string memory licenseId,
            uint256 voteCount,
            bool executed
        )
    {
        require(_proposalId < proposalCount, "PillChain: proposal does not exist");
        AuthProposal storage p = proposals[_proposalId];
        return (p.candidate, p.name, p.licenseId, p.voteCount, p.executed);
    }

    /**
     * @notice Check whether a specific committee member voted on a proposal.
     */
    function hasVotedOn(uint256 _proposalId, address _member) external view returns (bool) {
        require(_proposalId < proposalCount, "PillChain: proposal does not exist");
        return proposals[_proposalId].hasVoted[_member];
    }

    /**
     * @notice Return all 5 committee addresses.
     */
    function getCommittee() external view returns (address[] memory) {
        return committee;
    }

    // ────────────────────  Manufacturer Functions  ──────────────

    /**
     * @notice Register a new drug batch on-chain.
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

    function verifyBatch(string memory _batchId)
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
        if (!b.exists) return (false, false, false, b);

        isAuthentic = true;
        isExpired   = block.timestamp > b.expiryDate;
        isRevoked   = b.isRevoked;
        batch       = b;
    }

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

    function getBatchCount() external view returns (uint256) {
        return batchIds.length;
    }

    function getBatchIdAtIndex(uint256 _index) external view returns (string memory) {
        require(_index < batchIds.length, "PillChain: index out of bounds");
        return batchIds[_index];
    }

    function getAllBatchIds() external view returns (string[] memory) {
        return batchIds;
    }

    // ─────────────────────  Community Actions  ───────────────────

    /**
     * @notice Flag a batch as suspicious and earn PILL token rewards.
     */
    function reportCounterfeit(string memory _batchId) external {
        if (address(pillToken) != address(0)) {
            pillToken.rewardReport(msg.sender, _batchId);
        }
        emit CounterfeitReported(_batchId, msg.sender, block.timestamp);
    }
}

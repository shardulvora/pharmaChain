// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PillToken is ERC20, Ownable {
    uint256 public constant REPORT_REWARD    = 10 * 10 ** 18;
    uint256 public constant VERIFY_REWARD    = 1 * 10 ** 18;
    uint256 public constant MAX_DAILY_VERIFY = 5 * 10 ** 18;

    address public pillChainContract;

    mapping(address => uint256) public lastVerifyDate;
    mapping(address => uint256) public dailyVerifyEarned;
    mapping(address => mapping(string => bool)) public hasReported;

    event PillChainContractSet(address indexed contractAddress);
    event ReportRewarded(address indexed reporter, string batchId, uint256 amount);
    event VerifyRewarded(address indexed verifier, uint256 amount);

    constructor() ERC20("PillToken", "PILL") Ownable(msg.sender) {}

    function setPillChainContract(address _contract) external onlyOwner {
        require(_contract != address(0), "PillToken: zero address");
        pillChainContract = _contract;
        emit PillChainContractSet(_contract);
    }

    function rewardReport(address _reporter, string memory _batchId) external {
        require(msg.sender == pillChainContract, "PillToken: only PillChain");
        require(!hasReported[_reporter][_batchId], "PillToken: already reported");

        hasReported[_reporter][_batchId] = true;
        _mint(_reporter, REPORT_REWARD);
        emit ReportRewarded(_reporter, _batchId, REPORT_REWARD);
    }

    function rewardVerification(address _verifier) external {
        require(msg.sender == pillChainContract, "PillToken: only PillChain");

        uint256 today = block.timestamp / 86400;

        if (lastVerifyDate[_verifier] < today) {
            lastVerifyDate[_verifier] = today;
            dailyVerifyEarned[_verifier] = 0;
        }

        if (dailyVerifyEarned[_verifier] < MAX_DAILY_VERIFY) {
            dailyVerifyEarned[_verifier] += VERIFY_REWARD;
            _mint(_verifier, VERIFY_REWARD);
            emit VerifyRewarded(_verifier, VERIFY_REWARD);
        }
    }
}

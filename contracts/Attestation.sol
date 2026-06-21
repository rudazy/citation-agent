// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract Attestation {
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant MIN_STAKE = 100_000; // 0.1 USDC (6 decimals)

    struct Attest {
        address staker;
        uint256 amount;
        string claim;
        string target;
        uint256 timestamp;
    }

    mapping(string => Attest[]) public attestations;
    mapping(string => uint256) public totalStaked;

    event Attested(string indexed target, address indexed staker, string claim, uint256 amount);

    function attest(string memory target, string memory claim, uint256 amount) external {
        require(amount >= MIN_STAKE, "Min stake 0.1 USDC");
        require(bytes(target).length > 0, "Target required");
        require(bytes(claim).length > 0, "Claim required");

        IERC20(USDC).transferFrom(msg.sender, address(this), amount);

        attestations[target].push(
            Attest({staker: msg.sender, amount: amount, claim: claim, target: target, timestamp: block.timestamp})
        );
        totalStaked[target] += amount;

        emit Attested(target, msg.sender, claim, amount);
    }

    function getAttestations(string memory target) external view returns (Attest[] memory) {
        return attestations[target];
    }

    function attestationCount(string memory target) external view returns (uint256) {
        return attestations[target].length;
    }
}
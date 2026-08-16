// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAttestEntry {
    function attest(string memory target, string memory claim, uint256 amount) external;
}

/// @notice A token that calls back into the attestation contract during `transfer`,
///         used to prove the reentrancy guard holds on the exit paths.
/// @dev `setVictim` rather than a constructor arg, because the contract under test
///      needs this token's address at ITS construction — the cycle has to break here.
contract ReentrantUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public victim;
    bool public attempted;
    string public lastRevertReason;

    function setVictim(address target) external {
        victim = target;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ReentrantUSDC: allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    /// @dev Re-enters exactly once, on the first outbound transfer.
    function transfer(address to, uint256 amount) external returns (bool) {
        if (!attempted && victim != address(0)) {
            attempted = true;
            try IAttestEntry(victim).attest("reentry", "reentry", 100_000) {
                lastRevertReason = "";
            } catch Error(string memory reason) {
                lastRevertReason = reason;
            }
        }
        _move(msg.sender, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "ReentrantUSDC: balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

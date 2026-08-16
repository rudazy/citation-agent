// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice A token that reports failure by returning `false` instead of reverting,
///         used to prove every transfer return value is checked.
/// @dev Failure modes are toggled after construction so a single instance can be
///      handed to the contract under test and then made to fail on demand.
contract FalseReturnUSDC {
    mapping(address => uint256) public balanceOf;

    /// @notice When set, every outbound `transfer` returns false.
    bool public failTransfer;

    /// @notice When set, `transferFrom` returns false for this destination only,
    ///         so the fee leg and the stake leg can be failed independently.
    address public failTransferFromTo;

    function setFailTransfer(bool value) external {
        failTransfer = value;
    }

    function setFailTransferFromTo(address to) external {
        failTransferFromTo = to;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (failTransfer) return false;
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (to == failTransferFromTo) return false;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "FalseReturnUSDC: balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

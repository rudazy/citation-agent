// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract CanteenUSDC {
    address public constant UNDERLYING_USDC = 0x3600000000000000000000000000000000000000;
    string public name = "Canteen USDC";
    string public symbol = "cUSDC";
    uint8 public decimals = 6;

    mapping(address => uint256) public balanceOf;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Wrapped(address indexed user, uint256 amount);
    event Unwrapped(address indexed user, uint256 amount);

    function wrap(uint256 amount) external {
        IERC20(UNDERLYING_USDC).transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
        emit Wrapped(msg.sender, amount);
        emit Transfer(address(0), msg.sender, amount);
    }

    function unwrap(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        IERC20(UNDERLYING_USDC).transfer(msg.sender, amount);
        emit Unwrapped(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }
}
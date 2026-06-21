// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Attestation} from "../contracts/Attestation.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract AttestationTest is Test {
    Attestation internal attestation;
    address internal staker = address(0xBEEF);

    function setUp() public {
        attestation = new Attestation();
    }

    function _mockTransferFrom(uint256 amount) internal {
        vm.mockCall(
            attestation.USDC(),
            abi.encodeWithSelector(IERC20.transferFrom.selector, staker, address(attestation), amount),
            abi.encode(true)
        );
    }

    function test_attest_minStake() public {
        _mockTransferFrom(100_000);

        vm.prank(staker);
        attestation.attest("https://example.com", "Reliable source", 100_000);

        Attestation.Attest[] memory results = attestation.getAttestations("https://example.com");
        assertEq(results.length, 1);
        assertEq(results[0].staker, staker);
        assertEq(results[0].amount, 100_000);
        assertEq(results[0].claim, "Reliable source");
        assertEq(attestation.totalStaked("https://example.com"), 100_000);
    }

    function test_revert_belowMinStake() public {
        vm.prank(staker);
        vm.expectRevert(bytes("Min stake 0.1 USDC"));
        attestation.attest("wallet:0xabc", "Bad stake", 99_999);
    }

    function test_revert_emptyTarget() public {
        vm.prank(staker);
        vm.expectRevert(bytes("Target required"));
        attestation.attest("", "Claim only", 100_000);
    }
}
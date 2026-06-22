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
    address internal platform = address(0xCAFE);

    function setUp() public {
        attestation = new Attestation(platform);
    }

    function _mockTransferFrom(address from, address to, uint256 amount) internal {
        vm.mockCall(
            attestation.USDC(),
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount),
            abi.encode(true)
        );
    }

    function test_attest_minStake_chargesPlatformFee() public {
        uint256 stake = 100_000;
        uint256 fee = attestation.PLATFORM_FEE();

        _mockTransferFrom(staker, platform, fee);
        _mockTransferFrom(staker, address(attestation), stake);

        vm.prank(staker);
        attestation.attest("https://example.com", "Reliable source", stake);

        Attestation.Attest[] memory results = attestation.getAttestations("https://example.com");
        assertEq(results.length, 1);
        assertEq(results[0].staker, staker);
        assertEq(results[0].amount, stake);
        assertEq(results[0].claim, "Reliable source");
        assertEq(attestation.totalStaked("https://example.com"), stake);
        assertEq(attestation.platformFeeRecipient(), platform);
    }

    function test_attest_largeStake_flatFee() public {
        uint256 stake = 20_000_000; // 20 USDC
        uint256 fee = attestation.PLATFORM_FEE();

        _mockTransferFrom(staker, platform, fee);
        _mockTransferFrom(staker, address(attestation), stake);

        vm.prank(staker);
        attestation.attest("wallet:0xabc", "High conviction", stake);

        assertEq(attestation.totalStaked("wallet:0xabc"), stake);
        assertEq(attestation.PLATFORM_FEE(), 100_000);
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

    function test_revert_zeroPlatformRecipient() public {
        vm.expectRevert(bytes("Invalid platform recipient"));
        new Attestation(address(0));
    }
}
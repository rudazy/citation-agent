// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Attestation} from "../contracts/Attestation.sol";

/// @title Deploy Attestation (Arc Testnet)
/// @notice Platform fee recipient is immutable in Attestation.sol — set it once at deploy.
///
/// Arc Testnet (chainId 5042002):
///   forge script script/DeployAttestation.s.sol:DeployAttestation ^
///     --rpc-url https://rpc.testnet.arc.network ^
///     --chain-id 5042002 ^
///     --broadcast ^
///     --private-key %DEPLOYER_PRIVATE_KEY%
///
/// Optional verify (set ARCSCAN_API_KEY):
///   forge verify-contract <DEPLOYED_ADDRESS> contracts/Attestation.sol:Attestation ^
///     --constructor-args $(cast abi-encode "constructor(address)" 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62) ^
///     --chain-id 5042002 ^
///     --rpc-url https://rpc.testnet.arc.network ^
///     --etherscan-api-key %ARCSCAN_API_KEY%
contract DeployAttestation is Script {
    /// @dev Operator wallet = immutable platformFeeRecipient on the deployed contract.
    address internal constant PLATFORM_FEE_RECIPIENT = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62;

    /// @notice Default deploy — uses PLATFORM_FEE_RECIPIENT above.
    function run() external returns (Attestation deployed) {
        return run(PLATFORM_FEE_RECIPIENT);
    }

    /// @notice Deploy with an explicit recipient (must match operator wallet in production).
    function run(address platformRecipient) public returns (Attestation deployed) {
        require(platformRecipient != address(0), "platformRecipient required");
        vm.startBroadcast();
        deployed = new Attestation(platformRecipient);
        vm.stopBroadcast();
    }
}
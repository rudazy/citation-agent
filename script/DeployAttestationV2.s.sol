// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AttestationV2} from "../contracts/AttestationV2.sol";

/// @title Deploy AttestationV2 (Arc Testnet)
/// @notice Replaces the v1 Attestation deployment, which has no exit path for staked
///         funds. Read `docs/attestation-v2-migration.md` before running this — the
///         v1 balance is not recoverable and does not migrate.
///
/// @dev `platformFeeRecipient` and `lockPeriod` are immutable, and `arbiter` is only
///      transferable by the arbiter itself. Set all three correctly at deploy time.
///
/// Arc Testnet (chainId 5042002):
///   forge script script/DeployAttestationV2.s.sol:DeployAttestationV2 ^
///     --rpc-url https://rpc.testnet.arc.network ^
///     --chain-id 5042002 ^
///     --broadcast ^
///     --private-key %DEPLOYER_PRIVATE_KEY%
///
/// Verify (set ARCSCAN_API_KEY):
///   forge verify-contract <DEPLOYED_ADDRESS> contracts/AttestationV2.sol:AttestationV2 ^
///     --constructor-args $(cast abi-encode "constructor(address,address,address,uint256)" ^
///       0x3600000000000000000000000000000000000000 ^
///       0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62 ^
///       0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62 ^
///       604800) ^
///     --chain-id 5042002 ^
///     --rpc-url https://rpc.testnet.arc.network ^
///     --etherscan-api-key %ARCSCAN_API_KEY%
///
/// For a future Arc mainnet deploy, override `USDC` with the mainnet address —
/// Circle has not published it yet, so do not assume it matches testnet. Use
/// `deployWith(...)`; the no-arg `run()` is testnet-only by design.
contract DeployAttestationV2 is Script {
    /// @dev Arc **Testnet** USDC. Circle documents mainnet addresses as not yet
    ///      available, which is why the contract takes this as a constructor arg
    ///      instead of hardcoding it. Confirm the address before any mainnet deploy.
    address internal constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;

    /// @dev Operator wallet — receives the flat platform fee per attestation.
    address internal constant PLATFORM_FEE_RECIPIENT = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62;

    /// @dev Settles disputes: freeze, release, slash. Same operator wallet for now;
    ///      transferable later via proposeArbiter / acceptArbiter without redeploying.
    address internal constant ARBITER = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62;

    /// @dev Covers the 72h resolution dispute window plus adjudication headroom, so a
    ///      losing challenger cannot withdraw before the arbiter can act.
    uint256 internal constant LOCK_PERIOD = 7 days;

    /// @notice Default deploy — uses the constants above.
    /// @dev Deliberately not overloaded: `forge script` refuses to pick between two
    ///      functions named `run`, which is why the plain command below works here
    ///      but fails on the v1 `DeployAttestation.s.sol`.
    function run() external returns (AttestationV2 deployed) {
        return deployWith(ARC_TESTNET_USDC, PLATFORM_FEE_RECIPIENT, ARBITER, LOCK_PERIOD);
    }

    /// @notice Deploy with explicit parameters (must match the operator wallet in production).
    function deployWith(
        address usdc,
        address platformRecipient,
        address arbiter,
        uint256 lockPeriod
    ) public returns (AttestationV2 deployed) {
        require(usdc != address(0), "usdc required");
        require(platformRecipient != address(0), "platformRecipient required");
        require(arbiter != address(0), "arbiter required");

        vm.startBroadcast();
        deployed = new AttestationV2(usdc, platformRecipient, arbiter, lockPeriod);
        vm.stopBroadcast();
    }
}

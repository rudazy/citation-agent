// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Attestation} from "../contracts/Attestation.sol";

contract DeployAttestation is Script {
    function run() external returns (Attestation deployed) {
        address platformRecipient = vm.envAddress("SELLER_ADDRESS");
        vm.startBroadcast();
        deployed = new Attestation(platformRecipient);
        vm.stopBroadcast();
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {CanteenUSDC} from "../contracts/CanteenUSDC.sol";

contract DeployCanteenUSDC is Script {
    function run() external returns (CanteenUSDC deployed) {
        vm.startBroadcast();
        deployed = new CanteenUSDC();
        vm.stopBroadcast();
    }
}
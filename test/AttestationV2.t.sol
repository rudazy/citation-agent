// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AttestationV2} from "../contracts/AttestationV2.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";
import {ReentrantUSDC} from "./helpers/ReentrantUSDC.sol";
import {FalseReturnUSDC} from "./helpers/FalseReturnUSDC.sol";

contract AttestationV2Test is Test {
    AttestationV2 internal attestation;
    MockUSDC internal usdc;

    address internal staker = address(0xBEEF);
    address internal other = address(0xFEED);
    address internal platform = address(0xCAFE);
    address internal arbiter = address(0xA151);
    address internal beneficiary = address(0xB0B);
    address internal stranger = address(0xDEAD);

    uint256 internal constant LOCK_PERIOD = 7 days;
    uint256 internal constant STAKE = 1_000_000; // 1 USDC
    string internal constant TARGET = "citation:post-1";

    event StakeOpened(
        string indexed target,
        uint256 indexed index,
        address indexed staker,
        uint256 amount,
        uint256 unlockAt
    );
    event StakeWithdrawn(
        string indexed target,
        uint256 indexed index,
        address indexed staker,
        uint256 amount
    );
    event StakeReleased(
        string indexed target,
        uint256 indexed index,
        address indexed staker,
        uint256 amount
    );
    event StakeSlashed(
        string indexed target,
        uint256 indexed index,
        address indexed staker,
        address beneficiary,
        uint256 amount
    );
    event StakeReclaimed(
        string indexed target,
        uint256 indexed index,
        address indexed staker,
        uint256 amount,
        uint256 frozenAt
    );
    event StakeFrozen(string indexed target, uint256 indexed index, address indexed staker);
    event ArbiterTransferred(address indexed previous, address indexed current);

    function setUp() public {
        usdc = new MockUSDC();
        attestation = new AttestationV2(address(usdc), platform, arbiter, LOCK_PERIOD);

        _fund(staker, 100_000_000);
        _fund(other, 100_000_000);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(attestation), type(uint256).max);
    }

    function _attest(address who, string memory target, uint256 amount) internal {
        vm.prank(who);
        attestation.attest(target, "Reliable source", amount);
    }

    function _balance(address who) internal view returns (uint256) {
        return usdc.balanceOf(who);
    }

    function _status(string memory target, uint256 index)
        internal
        view
        returns (AttestationV2.StakeStatus)
    {
        return attestation.getAttestations(target)[index].status;
    }

    // --- attest -------------------------------------------------------------

    function test_attest_minStake_chargesPlatformFeeAndLocksStake() public {
        uint256 stake = attestation.MIN_STAKE();
        uint256 fee = attestation.PLATFORM_FEE();
        uint256 stakerBefore = _balance(staker);

        _attest(staker, TARGET, stake);

        AttestationV2.Attest[] memory results = attestation.getAttestations(TARGET);
        assertEq(results.length, 1);
        assertEq(results[0].staker, staker);
        assertEq(results[0].amount, stake);
        assertEq(results[0].claim, "Reliable source");
        assertEq(results[0].target, TARGET);
        assertEq(results[0].timestamp, block.timestamp);
        assertEq(results[0].unlockAt, block.timestamp + LOCK_PERIOD);
        assertEq(results[0].frozenAt, 0);
        assertEq(uint256(results[0].status), uint256(AttestationV2.StakeStatus.Active));

        assertEq(attestation.totalStaked(TARGET), stake);
        assertEq(attestation.lifetimeStaked(TARGET), stake);
        assertEq(attestation.totalEscrowed(), stake);

        assertEq(_balance(platform), fee);
        assertEq(_balance(address(attestation)), stake);
        assertEq(_balance(staker), stakerBefore - stake - fee);
    }

    function test_attest_largeStake_flatFee() public {
        uint256 stake = 20_000_000; // 20 USDC
        _attest(staker, "wallet:0xabc", stake);

        assertEq(attestation.totalStaked("wallet:0xabc"), stake);
        assertEq(attestation.PLATFORM_FEE(), 100_000);
        assertEq(_balance(platform), 100_000);
    }

    function test_attest_emitsStakeOpenedWithIncrementingIndex() public {
        vm.expectEmit(true, true, true, true, address(attestation));
        emit StakeOpened(TARGET, 0, staker, STAKE, block.timestamp + LOCK_PERIOD);
        _attest(staker, TARGET, STAKE);

        vm.expectEmit(true, true, true, true, address(attestation));
        emit StakeOpened(TARGET, 1, other, STAKE, block.timestamp + LOCK_PERIOD);
        _attest(other, TARGET, STAKE);

        assertEq(attestation.attestationCount(TARGET), 2);
        assertEq(attestation.totalStaked(TARGET), STAKE * 2);
        assertEq(attestation.totalEscrowed(), STAKE * 2);
    }

    function test_attest_revert_belowMinStake() public {
        vm.prank(staker);
        vm.expectRevert(bytes("Min stake 0.1 USDC"));
        attestation.attest(TARGET, "Bad stake", 99_999);
    }

    function test_attest_revert_emptyTarget() public {
        vm.prank(staker);
        vm.expectRevert(bytes("Target required"));
        attestation.attest("", "Claim only", STAKE);
    }

    function test_attest_revert_emptyClaim() public {
        vm.prank(staker);
        vm.expectRevert(bytes("Claim required"));
        attestation.attest(TARGET, "", STAKE);
    }

    // --- constructor --------------------------------------------------------

    function test_constructor_revert_zeroUsdc() public {
        vm.expectRevert(bytes("Invalid USDC address"));
        new AttestationV2(address(0), platform, arbiter, LOCK_PERIOD);
    }

    function test_constructor_revert_zeroPlatformRecipient() public {
        vm.expectRevert(bytes("Invalid platform recipient"));
        new AttestationV2(address(usdc), address(0), arbiter, LOCK_PERIOD);
    }

    function test_constructor_revert_zeroArbiter() public {
        vm.expectRevert(bytes("Invalid arbiter"));
        new AttestationV2(address(usdc), platform, address(0), LOCK_PERIOD);
    }

    function test_constructor_revert_lockPeriodTooLong() public {
        vm.expectRevert(bytes("Lock period too long"));
        new AttestationV2(address(usdc), platform, arbiter, 366 days);
    }

    function test_constructor_setsArbiterAndEmits() public {
        vm.expectEmit(true, true, false, false);
        emit ArbiterTransferred(address(0), arbiter);
        AttestationV2 fresh = new AttestationV2(address(usdc), platform, arbiter, LOCK_PERIOD);

        assertEq(fresh.arbiter(), arbiter);
        assertEq(fresh.pendingArbiter(), address(0));
        assertEq(fresh.lockPeriod(), LOCK_PERIOD);
    }

    /// @dev The settlement token is per-deployment, so the same source can serve
    ///      testnet and a mainnet whose USDC address Circle has not yet published.
    function test_constructor_usesTheTokenItWasGiven() public {
        MockUSDC otherToken = new MockUSDC();
        AttestationV2 fresh = new AttestationV2(address(otherToken), platform, arbiter, LOCK_PERIOD);
        assertEq(fresh.USDC(), address(otherToken));
        assertEq(attestation.USDC(), address(usdc));

        otherToken.mint(staker, 10_000_000);
        vm.startPrank(staker);
        otherToken.approve(address(fresh), type(uint256).max);
        fresh.attest(TARGET, "Reliable source", STAKE);
        vm.stopPrank();

        // Settled in the token it was handed, and nowhere near the default one.
        assertEq(otherToken.balanceOf(address(fresh)), STAKE);
        assertEq(usdc.balanceOf(address(fresh)), 0);
    }

    // --- withdraw -----------------------------------------------------------

    function test_withdraw_afterLock_returnsStake() public {
        _attest(staker, TARGET, STAKE);
        uint256 stakerBefore = _balance(staker);

        vm.warp(block.timestamp + LOCK_PERIOD);

        vm.expectEmit(true, true, true, true, address(attestation));
        emit StakeWithdrawn(TARGET, 0, staker, STAKE);
        vm.prank(staker);
        attestation.withdraw(TARGET, 0);

        assertEq(_balance(staker), stakerBefore + STAKE);
        assertEq(_balance(address(attestation)), 0);
        assertEq(uint256(_status(TARGET, 0)), uint256(AttestationV2.StakeStatus.Withdrawn));
        assertEq(attestation.totalStaked(TARGET), 0);
        assertEq(attestation.totalEscrowed(), 0);
        // Lifetime figures must survive the exit.
        assertEq(attestation.lifetimeStaked(TARGET), STAKE);
    }

    function test_withdraw_revert_beforeUnlock() public {
        _attest(staker, TARGET, STAKE);

        vm.warp(block.timestamp + LOCK_PERIOD - 1);
        vm.prank(staker);
        vm.expectRevert(bytes("Stake still locked"));
        attestation.withdraw(TARGET, 0);
    }

    function test_withdraw_revert_notStaker() public {
        _attest(staker, TARGET, STAKE);
        vm.warp(block.timestamp + LOCK_PERIOD);

        vm.prank(stranger);
        vm.expectRevert(bytes("Not the staker"));
        attestation.withdraw(TARGET, 0);
    }

    function test_withdraw_revert_alreadyWithdrawn() public {
        _attest(staker, TARGET, STAKE);
        vm.warp(block.timestamp + LOCK_PERIOD);

        vm.prank(staker);
        attestation.withdraw(TARGET, 0);

        vm.prank(staker);
        vm.expectRevert(bytes("Stake already closed"));
        attestation.withdraw(TARGET, 0);
    }

    function test_withdraw_revert_whileFrozen() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.warp(block.timestamp + LOCK_PERIOD);
        vm.prank(staker);
        vm.expectRevert(bytes("Stake is frozen"));
        attestation.withdraw(TARGET, 0);
    }

    function test_withdraw_revert_badIndex() public {
        _attest(staker, TARGET, STAKE);

        vm.prank(staker);
        vm.expectRevert(bytes("No such attestation"));
        attestation.withdraw(TARGET, 1);
    }

    function test_withdraw_onlyTouchesItsOwnStake() public {
        _attest(staker, TARGET, STAKE);
        _attest(other, TARGET, STAKE);
        vm.warp(block.timestamp + LOCK_PERIOD);

        vm.prank(other);
        attestation.withdraw(TARGET, 1);

        assertEq(attestation.totalStaked(TARGET), STAKE);
        assertEq(attestation.totalEscrowed(), STAKE);
        assertEq(uint256(_status(TARGET, 0)), uint256(AttestationV2.StakeStatus.Active));
    }

    // --- freeze / unfreeze --------------------------------------------------

    function test_freeze_thenUnfreeze_restoresWithdrawal() public {
        _attest(staker, TARGET, STAKE);

        vm.expectEmit(true, true, true, false, address(attestation));
        emit StakeFrozen(TARGET, 0, staker);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        assertEq(attestation.getAttestations(TARGET)[0].frozenAt, block.timestamp);

        vm.prank(arbiter);
        attestation.unfreeze(TARGET, 0);
        assertEq(attestation.getAttestations(TARGET)[0].frozenAt, 0);

        vm.warp(block.timestamp + LOCK_PERIOD);
        vm.prank(staker);
        attestation.withdraw(TARGET, 0);
        assertEq(uint256(_status(TARGET, 0)), uint256(AttestationV2.StakeStatus.Withdrawn));
    }

    function test_freeze_revert_notArbiter() public {
        _attest(staker, TARGET, STAKE);

        vm.prank(stranger);
        vm.expectRevert(bytes("Not the arbiter"));
        attestation.freeze(TARGET, 0);
    }

    function test_freeze_revert_alreadyFrozen() public {
        _attest(staker, TARGET, STAKE);
        vm.startPrank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.expectRevert(bytes("Already frozen"));
        attestation.freeze(TARGET, 0);
        vm.stopPrank();
    }

    function test_freeze_revert_stakeClosed() public {
        _attest(staker, TARGET, STAKE);
        vm.warp(block.timestamp + LOCK_PERIOD);
        vm.prank(staker);
        attestation.withdraw(TARGET, 0);

        vm.prank(arbiter);
        vm.expectRevert(bytes("Stake already closed"));
        attestation.freeze(TARGET, 0);
    }

    function test_unfreeze_revert_notFrozen() public {
        _attest(staker, TARGET, STAKE);

        vm.prank(arbiter);
        vm.expectRevert(bytes("Not frozen"));
        attestation.unfreeze(TARGET, 0);
    }

    function test_unfreeze_revert_notArbiter() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.prank(stranger);
        vm.expectRevert(bytes("Not the arbiter"));
        attestation.unfreeze(TARGET, 0);
    }

    function test_unfreeze_revert_stakeClosed() public {
        _attest(staker, TARGET, STAKE);
        vm.startPrank(arbiter);
        attestation.freeze(TARGET, 0);
        attestation.release(TARGET, 0);

        vm.expectRevert(bytes("Stake already closed"));
        attestation.unfreeze(TARGET, 0);
        vm.stopPrank();
    }

    // --- release ------------------------------------------------------------

    function test_release_beforeLock_returnsToStaker() public {
        _attest(staker, TARGET, STAKE);
        uint256 stakerBefore = _balance(staker);

        vm.expectEmit(true, true, true, true, address(attestation));
        emit StakeReleased(TARGET, 0, staker, STAKE);
        vm.prank(arbiter);
        attestation.release(TARGET, 0);

        assertEq(_balance(staker), stakerBefore + STAKE);
        assertEq(uint256(_status(TARGET, 0)), uint256(AttestationV2.StakeStatus.Released));
        assertEq(attestation.totalStaked(TARGET), 0);
        assertEq(attestation.totalEscrowed(), 0);
    }

    function test_release_whileFrozen_returnsToStaker() public {
        _attest(staker, TARGET, STAKE);
        uint256 stakerBefore = _balance(staker);

        vm.startPrank(arbiter);
        attestation.freeze(TARGET, 0);
        attestation.release(TARGET, 0);
        vm.stopPrank();

        assertEq(_balance(staker), stakerBefore + STAKE);
        assertEq(attestation.getAttestations(TARGET)[0].frozenAt, 0);
    }

    function test_release_revert_notArbiter() public {
        _attest(staker, TARGET, STAKE);

        vm.prank(staker);
        vm.expectRevert(bytes("Not the arbiter"));
        attestation.release(TARGET, 0);
    }

    function test_release_revert_alreadyClosed() public {
        _attest(staker, TARGET, STAKE);
        vm.startPrank(arbiter);
        attestation.release(TARGET, 0);

        vm.expectRevert(bytes("Stake already closed"));
        attestation.release(TARGET, 0);
        vm.stopPrank();
    }

    // --- slash --------------------------------------------------------------

    function test_slash_afterFreezeAndDelay_paysBeneficiary() public {
        _attest(staker, TARGET, STAKE);
        uint256 stakerBefore = _balance(staker);

        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        vm.warp(block.timestamp + attestation.SLASH_DELAY());

        vm.expectEmit(true, true, true, true, address(attestation));
        emit StakeSlashed(TARGET, 0, staker, beneficiary, STAKE);
        vm.prank(arbiter);
        attestation.slash(TARGET, 0, beneficiary);

        assertEq(_balance(beneficiary), STAKE);
        assertEq(_balance(staker), stakerBefore);
        assertEq(_balance(address(attestation)), 0);
        assertEq(uint256(_status(TARGET, 0)), uint256(AttestationV2.StakeStatus.Slashed));
        assertEq(attestation.totalStaked(TARGET), 0);
        assertEq(attestation.totalEscrowed(), 0);
        assertEq(attestation.lifetimeStaked(TARGET), STAKE);
    }

    function test_slash_revert_notFrozen() public {
        _attest(staker, TARGET, STAKE);
        vm.warp(block.timestamp + LOCK_PERIOD);

        vm.prank(arbiter);
        vm.expectRevert(bytes("Freeze before slashing"));
        attestation.slash(TARGET, 0, beneficiary);
    }

    function test_slash_revert_beforeDelayElapsed() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.warp(block.timestamp + attestation.SLASH_DELAY() - 1);
        vm.prank(arbiter);
        vm.expectRevert(bytes("Slash delay not elapsed"));
        attestation.slash(TARGET, 0, beneficiary);
    }

    function test_slash_revert_zeroBeneficiary() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        vm.warp(block.timestamp + attestation.SLASH_DELAY());

        vm.prank(arbiter);
        vm.expectRevert(bytes("Beneficiary required"));
        attestation.slash(TARGET, 0, address(0));
    }

    function test_slash_revert_notArbiter() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        vm.warp(block.timestamp + attestation.SLASH_DELAY());

        vm.prank(stranger);
        vm.expectRevert(bytes("Not the arbiter"));
        attestation.slash(TARGET, 0, beneficiary);
    }

    function test_slash_revert_alreadyClosed() public {
        _attest(staker, TARGET, STAKE);
        vm.startPrank(arbiter);
        attestation.freeze(TARGET, 0);
        vm.warp(block.timestamp + attestation.SLASH_DELAY());
        attestation.slash(TARGET, 0, beneficiary);

        vm.expectRevert(bytes("Stake already closed"));
        attestation.slash(TARGET, 0, beneficiary);
        vm.stopPrank();
    }

    // --- one exit only ------------------------------------------------------

    function test_withdrawThenSlash_reverts() public {
        _attest(staker, TARGET, STAKE);
        vm.warp(block.timestamp + LOCK_PERIOD);
        vm.prank(staker);
        attestation.withdraw(TARGET, 0);

        vm.prank(arbiter);
        vm.expectRevert(bytes("Stake already closed"));
        attestation.slash(TARGET, 0, beneficiary);

        // And the stake can never be re-opened to reach a slash later.
        vm.prank(arbiter);
        vm.expectRevert(bytes("Stake already closed"));
        attestation.freeze(TARGET, 0);
    }

    function test_slashThenWithdraw_reverts() public {
        _attest(staker, TARGET, STAKE);
        vm.startPrank(arbiter);
        attestation.freeze(TARGET, 0);
        vm.warp(block.timestamp + attestation.SLASH_DELAY());
        attestation.slash(TARGET, 0, beneficiary);
        vm.stopPrank();

        vm.warp(block.timestamp + LOCK_PERIOD);
        vm.prank(staker);
        vm.expectRevert(bytes("Stake already closed"));
        attestation.withdraw(TARGET, 0);
    }

    // --- arbiter handover ---------------------------------------------------

    function test_arbiterTransfer_isTwoStep() public {
        vm.prank(arbiter);
        attestation.proposeArbiter(other);

        // Power does not move on the proposal alone.
        assertEq(attestation.arbiter(), arbiter);
        assertEq(attestation.pendingArbiter(), other);

        vm.expectEmit(true, true, false, false, address(attestation));
        emit ArbiterTransferred(arbiter, other);
        vm.prank(other);
        attestation.acceptArbiter();

        assertEq(attestation.arbiter(), other);
        assertEq(attestation.pendingArbiter(), address(0));
    }

    function test_arbiterTransfer_oldArbiterLosesPower() public {
        _attest(staker, TARGET, STAKE);

        vm.prank(arbiter);
        attestation.proposeArbiter(other);
        vm.prank(other);
        attestation.acceptArbiter();

        vm.prank(arbiter);
        vm.expectRevert(bytes("Not the arbiter"));
        attestation.freeze(TARGET, 0);

        vm.prank(other);
        attestation.freeze(TARGET, 0);
        assertEq(attestation.getAttestations(TARGET)[0].frozenAt, block.timestamp);
    }

    function test_proposeArbiter_revert_notArbiter() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Not the arbiter"));
        attestation.proposeArbiter(other);
    }

    function test_proposeArbiter_revert_zeroAddress() public {
        vm.prank(arbiter);
        vm.expectRevert(bytes("Invalid arbiter"));
        attestation.proposeArbiter(address(0));
    }

    function test_acceptArbiter_revert_notPending() public {
        vm.prank(arbiter);
        attestation.proposeArbiter(other);

        vm.prank(stranger);
        vm.expectRevert(bytes("Not the pending arbiter"));
        attestation.acceptArbiter();
    }

    // --- reentrancy ---------------------------------------------------------

    function test_withdraw_reentrancyIsBlocked() public {
        ReentrantUSDC token = new ReentrantUSDC();
        AttestationV2 victim = new AttestationV2(address(token), platform, arbiter, LOCK_PERIOD);

        token.setVictim(address(victim));
        token.mint(staker, 100_000_000);
        vm.prank(staker);
        token.approve(address(victim), type(uint256).max);

        vm.prank(staker);
        victim.attest(TARGET, "Reliable source", STAKE);

        vm.warp(block.timestamp + LOCK_PERIOD);
        vm.prank(staker);
        victim.withdraw(TARGET, 0);

        // The token re-entered during the payout and was rejected by the guard.
        assertTrue(token.attempted());
        assertEq(token.lastRevertReason(), "Reentrant call");
        // The legitimate withdrawal still completed, and only once.
        assertEq(victim.totalEscrowed(), 0);
        assertEq(victim.attestationCount(TARGET), 1);
    }

    // --- solvency -----------------------------------------------------------

    function test_escrowTracksContractBalance_acrossLifecycle() public {
        _attest(staker, "citation:a", STAKE);
        _attest(other, "citation:a", STAKE * 2);
        _attest(staker, "citation:b", STAKE * 3);
        assertEq(attestation.totalEscrowed(), _balance(address(attestation)));

        vm.warp(block.timestamp + LOCK_PERIOD);
        vm.prank(staker);
        attestation.withdraw("citation:a", 0);
        assertEq(attestation.totalEscrowed(), _balance(address(attestation)));

        vm.startPrank(arbiter);
        attestation.freeze("citation:a", 1);
        vm.warp(block.timestamp + attestation.SLASH_DELAY());
        attestation.slash("citation:a", 1, beneficiary);
        assertEq(attestation.totalEscrowed(), _balance(address(attestation)));

        attestation.release("citation:b", 0);
        vm.stopPrank();

        assertEq(attestation.totalEscrowed(), 0);
        assertEq(_balance(address(attestation)), 0);
        assertEq(attestation.totalStaked("citation:a"), 0);
        assertEq(attestation.lifetimeStaked("citation:a"), STAKE * 3);
    }

    // --- abandoned freeze: staker reclaims ----------------------------------

    function test_reclaim_afterFreezeTimeout_returnsToStaker() public {
        _attest(staker, TARGET, STAKE);
        uint256 stakerBefore = _balance(staker);

        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        uint256 frozenAt = block.timestamp;

        vm.warp(block.timestamp + attestation.MAX_FREEZE_DURATION());

        vm.expectEmit(true, true, true, true, address(attestation));
        emit StakeReclaimed(TARGET, 0, staker, STAKE, frozenAt);
        vm.prank(staker);
        attestation.reclaimExpiredFreeze(TARGET, 0);

        assertEq(_balance(staker), stakerBefore + STAKE);
        assertEq(uint256(_status(TARGET, 0)), uint256(AttestationV2.StakeStatus.Reclaimed));
        assertEq(attestation.totalEscrowed(), 0);
        assertEq(attestation.lifetimeStaked(TARGET), STAKE);
    }

    function test_slash_revert_afterFreezeTimeout() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.warp(block.timestamp + attestation.MAX_FREEZE_DURATION());

        // The arbiter sat on it too long and has lost the power to take the stake.
        vm.prank(arbiter);
        vm.expectRevert(bytes("Freeze expired"));
        attestation.slash(TARGET, 0, beneficiary);
    }

    function test_slash_stillWorksOnLastDayOfFreezeWindow() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.warp(block.timestamp + attestation.MAX_FREEZE_DURATION() - 1);
        vm.prank(arbiter);
        attestation.slash(TARGET, 0, beneficiary);

        assertEq(_balance(beneficiary), STAKE);
    }

    /// @dev The bypass this constant exists to close: unfreeze/re-freeze must not
    ///      roll the deadline forward.
    function test_refreezing_cannotExtendTheDeadline() public {
        _attest(staker, TARGET, STAKE);
        uint256 firstFreeze = block.timestamp;

        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.warp(block.timestamp + 20 days);
        vm.startPrank(arbiter);
        attestation.unfreeze(TARGET, 0);
        attestation.freeze(TARGET, 0);
        vm.stopPrank();

        assertEq(attestation.getAttestations(TARGET)[0].firstFrozenAt, firstFreeze);

        // 30 days from the FIRST freeze, not from the re-freeze.
        vm.warp(firstFreeze + attestation.MAX_FREEZE_DURATION());
        assertTrue(attestation.isReclaimable(TARGET, 0));

        vm.prank(arbiter);
        vm.expectRevert(bytes("Freeze expired"));
        attestation.slash(TARGET, 0, beneficiary);

        vm.prank(staker);
        attestation.reclaimExpiredFreeze(TARGET, 0);
        assertEq(uint256(_status(TARGET, 0)), uint256(AttestationV2.StakeStatus.Reclaimed));
    }

    function test_reclaim_revert_beforeTimeout() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);

        vm.warp(block.timestamp + attestation.MAX_FREEZE_DURATION() - 1);
        vm.prank(staker);
        vm.expectRevert(bytes("Freeze has not expired"));
        attestation.reclaimExpiredFreeze(TARGET, 0);
    }

    function test_reclaim_revert_notFrozen() public {
        _attest(staker, TARGET, STAKE);
        vm.warp(block.timestamp + attestation.MAX_FREEZE_DURATION());

        vm.prank(staker);
        vm.expectRevert(bytes("Stake is not frozen"));
        attestation.reclaimExpiredFreeze(TARGET, 0);
    }

    function test_reclaim_revert_notStaker() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        vm.warp(block.timestamp + attestation.MAX_FREEZE_DURATION());

        // Explicitly including the arbiter: the timeout removes their power.
        vm.prank(arbiter);
        vm.expectRevert(bytes("Not the staker"));
        attestation.reclaimExpiredFreeze(TARGET, 0);

        vm.prank(stranger);
        vm.expectRevert(bytes("Not the staker"));
        attestation.reclaimExpiredFreeze(TARGET, 0);
    }

    function test_reclaim_revert_alreadyClosed() public {
        _attest(staker, TARGET, STAKE);
        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        vm.warp(block.timestamp + attestation.MAX_FREEZE_DURATION());

        vm.startPrank(staker);
        attestation.reclaimExpiredFreeze(TARGET, 0);

        vm.expectRevert(bytes("Stake already closed"));
        attestation.reclaimExpiredFreeze(TARGET, 0);
        vm.stopPrank();
    }

    /// @dev A timed-out freeze restores the ordinary rules — it does not exempt the
    ///      staker from the lock they chose.
    function test_reclaim_revert_whileStillWithinOwnLock() public {
        AttestationV2 longLock = new AttestationV2(address(usdc), platform, arbiter, 300 days);
        vm.prank(staker);
        usdc.approve(address(longLock), type(uint256).max);
        vm.prank(staker);
        longLock.attest(TARGET, "Reliable source", STAKE);

        vm.prank(arbiter);
        longLock.freeze(TARGET, 0);
        vm.warp(block.timestamp + longLock.MAX_FREEZE_DURATION());

        vm.prank(staker);
        vm.expectRevert(bytes("Stake still locked"));
        longLock.reclaimExpiredFreeze(TARGET, 0);
        assertFalse(longLock.isReclaimable(TARGET, 0));

        // Once the lock itself elapses, the stake comes back.
        vm.warp(block.timestamp + 300 days);
        assertTrue(longLock.isReclaimable(TARGET, 0));
        vm.prank(staker);
        longLock.reclaimExpiredFreeze(TARGET, 0);
    }

    function test_reclaim_revert_whenReturnTransferReturnsFalse() public {
        (AttestationV2 fresh, FalseReturnUSDC token) = _withFalseReturnToken();
        vm.prank(staker);
        fresh.attest(TARGET, "Reliable source", STAKE);

        vm.prank(arbiter);
        fresh.freeze(TARGET, 0);
        vm.warp(block.timestamp + fresh.MAX_FREEZE_DURATION());
        token.setFailTransfer(true);

        vm.prank(staker);
        vm.expectRevert(bytes("Stake return failed"));
        fresh.reclaimExpiredFreeze(TARGET, 0);
    }

    function test_isReclaimable_outOfRange() public {
        _attest(staker, TARGET, STAKE);
        assertFalse(attestation.isReclaimable(TARGET, 99));
    }

    // --- transfers that fail by return value --------------------------------

    /// @dev A token that signals failure with `false` rather than reverting, plus a
    ///      fresh contract wired to it.
    function _withFalseReturnToken() internal returns (AttestationV2 fresh, FalseReturnUSDC token) {
        token = new FalseReturnUSDC();
        fresh = new AttestationV2(address(token), platform, arbiter, LOCK_PERIOD);
        token.mint(staker, 100_000_000);
    }

    function test_attest_revert_whenFeeTransferReturnsFalse() public {
        (AttestationV2 fresh, FalseReturnUSDC token) = _withFalseReturnToken();
        token.setFailTransferFromTo(platform);

        vm.prank(staker);
        vm.expectRevert(bytes("Platform fee transfer failed"));
        fresh.attest(TARGET, "Reliable source", STAKE);
    }

    function test_attest_revert_whenStakeTransferReturnsFalse() public {
        (AttestationV2 fresh, FalseReturnUSDC token) = _withFalseReturnToken();
        token.setFailTransferFromTo(address(fresh));

        vm.prank(staker);
        vm.expectRevert(bytes("Stake transfer failed"));
        fresh.attest(TARGET, "Reliable source", STAKE);
    }

    function test_withdraw_revert_whenReturnTransferReturnsFalse() public {
        (AttestationV2 fresh, FalseReturnUSDC token) = _withFalseReturnToken();
        vm.prank(staker);
        fresh.attest(TARGET, "Reliable source", STAKE);

        token.setFailTransfer(true);
        vm.warp(block.timestamp + LOCK_PERIOD);

        vm.prank(staker);
        vm.expectRevert(bytes("Stake return failed"));
        fresh.withdraw(TARGET, 0);
    }

    function test_release_revert_whenReturnTransferReturnsFalse() public {
        (AttestationV2 fresh, FalseReturnUSDC token) = _withFalseReturnToken();
        vm.prank(staker);
        fresh.attest(TARGET, "Reliable source", STAKE);

        token.setFailTransfer(true);

        vm.prank(arbiter);
        vm.expectRevert(bytes("Stake return failed"));
        fresh.release(TARGET, 0);
    }

    function test_slash_revert_whenSlashTransferReturnsFalse() public {
        (AttestationV2 fresh, FalseReturnUSDC token) = _withFalseReturnToken();
        vm.prank(staker);
        fresh.attest(TARGET, "Reliable source", STAKE);

        vm.prank(arbiter);
        fresh.freeze(TARGET, 0);
        vm.warp(block.timestamp + fresh.SLASH_DELAY());
        token.setFailTransfer(true);

        vm.prank(arbiter);
        vm.expectRevert(bytes("Slash transfer failed"));
        fresh.slash(TARGET, 0, beneficiary);
    }

    // --- views --------------------------------------------------------------

    function test_isWithdrawable_reflectsLifecycle() public {
        _attest(staker, TARGET, STAKE);
        assertFalse(attestation.isWithdrawable(TARGET, 0), "locked");

        vm.warp(block.timestamp + LOCK_PERIOD);
        assertTrue(attestation.isWithdrawable(TARGET, 0), "unlocked");

        vm.prank(arbiter);
        attestation.freeze(TARGET, 0);
        assertFalse(attestation.isWithdrawable(TARGET, 0), "frozen");

        vm.prank(arbiter);
        attestation.unfreeze(TARGET, 0);
        assertTrue(attestation.isWithdrawable(TARGET, 0), "unfrozen");

        vm.prank(staker);
        attestation.withdraw(TARGET, 0);
        assertFalse(attestation.isWithdrawable(TARGET, 0), "closed");

        assertFalse(attestation.isWithdrawable(TARGET, 99), "out of range");
    }
}

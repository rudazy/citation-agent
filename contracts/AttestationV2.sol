// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice On-chain trust attestations with USDC stake, a flat platform fee, and a
///         complete stake lifecycle: time-locked withdrawal by the staker, plus
///         arbiter release and slash for adjudicated disputes.
///
/// @dev    Replaces `Attestation.sol`, which transferred every stake to itself and
///         exposed no withdraw, release, or slash function at all — every stake ever
///         filed against v1 is permanently locked there and cannot be recovered by
///         anyone. See `docs/attestation-v2-migration.md`.
///
///         `attest` and the `Attested` event keep v1's exact signature so existing
///         calldata decoding and event indexing continue to work unchanged.
contract AttestationV2 {
    /// @notice The USDC contract this deployment settles in.
    /// @dev Constructor-set rather than hardcoded. Circle documents
    ///      `0x3600…0000` as the **Arc Testnet** address and states that mainnet
    ///      addresses are not yet published, so baking it in would make this source
    ///      undeployable to mainnet if the address differs. Passing it at deploy time
    ///      lets the same audited source serve both networks.
    address public immutable USDC;

    uint256 public constant MIN_STAKE = 100_000; // 0.1 USDC (6 decimals)
    uint256 public constant PLATFORM_FEE = 100_000; // 0.1 USDC flat fee per attestation

    /// @notice A stake must sit frozen at least this long before the arbiter can slash
    ///         it. Every seizure is therefore announced on-chain a day before funds
    ///         move, which is the main public constraint on the trusted arbiter role.
    uint256 public constant SLASH_DELAY = 24 hours;

    /// @notice Ceiling on the configurable lock, so a deploy cannot re-create the v1
    ///         trap by setting a lock nobody lives to see expire.
    uint256 public constant MAX_LOCK_PERIOD = 365 days;

    /// @notice How long a stake may stay frozen before its staker can reclaim it and
    ///         the arbiter loses the power to slash it.
    ///
    ///         A legitimate dispute takes under 4 days end to end (72h dispute window
    ///         plus the 24h slash delay), so 30 days is generous room for a real
    ///         adjudication while still capping an abandoned or malicious freeze.
    ///
    /// @dev    Measured from `firstFrozenAt`, which is set once and never reset —
    ///         otherwise an arbiter could unfreeze and re-freeze to roll the deadline
    ///         forward forever and trap the stake anyway.
    uint256 public constant MAX_FREEZE_DURATION = 30 days;

    address public immutable platformFeeRecipient;

    /// @notice How long a stake is locked before its staker may withdraw it.
    uint256 public immutable lockPeriod;

    /// @notice Settles disputes: may freeze, release, and slash stakes.
    address public arbiter;

    /// @notice Arbiter transfer is two-step — a typo'd single-step handover would
    ///         brick the escrow and permanently re-trap every frozen stake.
    address public pendingArbiter;

    enum StakeStatus {
        Active,
        Withdrawn, // returned to the staker after the lock elapsed
        Released, // returned to the staker early by the arbiter
        Slashed, // paid to a beneficiary named by the arbiter
        Reclaimed // taken back by the staker after the arbiter abandoned a freeze
    }

    struct Attest {
        address staker;
        uint256 amount;
        string claim;
        string target;
        uint256 timestamp;
        uint256 unlockAt;
        uint256 frozenAt; // 0 = not currently frozen
        uint256 firstFrozenAt; // anchors the freeze deadline; never reset
        StakeStatus status;
    }

    mapping(string => Attest[]) public attestations;

    /// @notice Stake currently locked for a target. Decrements when a stake exits.
    mapping(string => uint256) public totalStaked;

    /// @notice Every unit ever staked on a target. Never decrements, so historical
    ///         backing figures do not silently drop when stakers exit.
    mapping(string => uint256) public lifetimeStaked;

    /// @notice Total stake this contract still owes across all targets. Anyone can
    ///         check solvency with `USDC.balanceOf(this) >= totalEscrowed`.
    uint256 public totalEscrowed;

    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _entered = NOT_ENTERED;

    event Attested(
        string indexed target,
        address indexed staker,
        string claim,
        uint256 amount,
        uint256 platformFee
    );
    /// @dev Carries the array index so indexers do not have to reconstruct it by
    ///      counting `Attested` events per target.
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
    /// @dev `frozenAt` is when the arbiter froze this stake and never acted on it, so
    ///      the record shows an abandoned freeze rather than a settled dispute.
    event StakeReclaimed(
        string indexed target,
        uint256 indexed index,
        address indexed staker,
        uint256 amount,
        uint256 frozenAt
    );
    event StakeFrozen(string indexed target, uint256 indexed index, address indexed staker);
    event StakeUnfrozen(string indexed target, uint256 indexed index, address indexed staker);
    event ArbiterProposed(address indexed current, address indexed proposed);
    event ArbiterTransferred(address indexed previous, address indexed current);

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not the arbiter");
        _;
    }

    /// @dev Every exit path flips a terminal status before transferring, so a
    ///      re-entered call already reverts on the status check. This guard is the
    ///      second line of defence.
    modifier nonReentrant() {
        require(_entered == NOT_ENTERED, "Reentrant call");
        _entered = ENTERED;
        _;
        _entered = NOT_ENTERED;
    }

    constructor(
        address _usdc,
        address _platformFeeRecipient,
        address _arbiter,
        uint256 _lockPeriod
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_platformFeeRecipient != address(0), "Invalid platform recipient");
        require(_arbiter != address(0), "Invalid arbiter");
        require(_lockPeriod <= MAX_LOCK_PERIOD, "Lock period too long");

        USDC = _usdc;
        platformFeeRecipient = _platformFeeRecipient;
        lockPeriod = _lockPeriod;
        arbiter = _arbiter;

        emit ArbiterTransferred(address(0), _arbiter);
    }

    /// @notice Stake USDC behind a claim about a target. Same signature as v1.
    function attest(string memory target, string memory claim, uint256 amount)
        external
        nonReentrant
    {
        require(amount >= MIN_STAKE, "Min stake 0.1 USDC");
        require(bytes(target).length > 0, "Target required");
        require(bytes(claim).length > 0, "Claim required");

        uint256 unlockAt = block.timestamp + lockPeriod;

        attestations[target].push(
            Attest({
                staker: msg.sender,
                amount: amount,
                claim: claim,
                target: target,
                timestamp: block.timestamp,
                unlockAt: unlockAt,
                frozenAt: 0,
                firstFrozenAt: 0,
                status: StakeStatus.Active
            })
        );
        uint256 index = attestations[target].length - 1;

        totalStaked[target] += amount;
        lifetimeStaked[target] += amount;
        totalEscrowed += amount;

        require(
            IERC20(USDC).transferFrom(msg.sender, platformFeeRecipient, PLATFORM_FEE),
            "Platform fee transfer failed"
        );
        require(
            IERC20(USDC).transferFrom(msg.sender, address(this), amount),
            "Stake transfer failed"
        );

        emit Attested(target, msg.sender, claim, amount, PLATFORM_FEE);
        emit StakeOpened(target, index, msg.sender, amount, unlockAt);
    }

    /// @notice Take your own stake back once its lock has elapsed.
    function withdraw(string memory target, uint256 index) external nonReentrant {
        Attest storage stake = _stakeAt(target, index);
        require(stake.staker == msg.sender, "Not the staker");
        require(stake.status == StakeStatus.Active, "Stake already closed");
        require(stake.frozenAt == 0, "Stake is frozen");
        require(block.timestamp >= stake.unlockAt, "Stake still locked");

        uint256 amount = _closeStake(target, stake, StakeStatus.Withdrawn);

        require(IERC20(USDC).transfer(msg.sender, amount), "Stake return failed");
        emit StakeWithdrawn(target, index, msg.sender, amount);
    }

    /// @notice Hold a stake open past its lock while a dispute is settled.
    /// @dev The freeze deadline anchors to the first freeze only. Re-freezing gives a
    ///      fresh `SLASH_DELAY` warning but cannot buy the arbiter more total time.
    function freeze(string memory target, uint256 index) external onlyArbiter {
        Attest storage stake = _stakeAt(target, index);
        require(stake.status == StakeStatus.Active, "Stake already closed");
        require(stake.frozenAt == 0, "Already frozen");

        stake.frozenAt = block.timestamp;
        if (stake.firstFrozenAt == 0) {
            stake.firstFrozenAt = block.timestamp;
        }
        emit StakeFrozen(target, index, stake.staker);
    }

    /// @notice Take your own stake back after the arbiter froze it and never acted.
    ///
    ///         The default on an unresolved, timed-out freeze is that the accused
    ///         keeps their money: they were never shown to be wrong. Nothing here is
    ///         callable by the arbiter, which is the point — the power to slash
    ///         expires with the freeze.
    ///
    /// @dev The staker's own lock still applies. Timing out a freeze restores the
    ///      ordinary rules; it does not exempt anyone from the commitment they made.
    function reclaimExpiredFreeze(string memory target, uint256 index) external nonReentrant {
        Attest storage stake = _stakeAt(target, index);
        require(stake.staker == msg.sender, "Not the staker");
        require(stake.status == StakeStatus.Active, "Stake already closed");
        require(stake.frozenAt != 0, "Stake is not frozen");
        require(
            block.timestamp >= stake.firstFrozenAt + MAX_FREEZE_DURATION,
            "Freeze has not expired"
        );
        require(block.timestamp >= stake.unlockAt, "Stake still locked");

        uint256 frozenAt = stake.frozenAt;
        uint256 amount = _closeStake(target, stake, StakeStatus.Reclaimed);

        require(IERC20(USDC).transfer(msg.sender, amount), "Stake return failed");
        emit StakeReclaimed(target, index, msg.sender, amount, frozenAt);
    }

    /// @notice Lift a freeze, returning the stake to ordinary lock rules.
    function unfreeze(string memory target, uint256 index) external onlyArbiter {
        Attest storage stake = _stakeAt(target, index);
        require(stake.status == StakeStatus.Active, "Stake already closed");
        require(stake.frozenAt != 0, "Not frozen");

        stake.frozenAt = 0;
        emit StakeUnfrozen(target, index, stake.staker);
    }

    /// @notice Return a stake to its staker immediately — e.g. a dispute settled in
    ///         the challenger's favour. Ignores the lock and any freeze, since
    ///         returning someone their own funds early is never a seizure.
    function release(string memory target, uint256 index) external onlyArbiter nonReentrant {
        Attest storage stake = _stakeAt(target, index);
        require(stake.status == StakeStatus.Active, "Stake already closed");

        address staker = stake.staker;
        stake.frozenAt = 0;
        uint256 amount = _closeStake(target, stake, StakeStatus.Released);

        require(IERC20(USDC).transfer(staker, amount), "Stake return failed");
        emit StakeReleased(target, index, staker, amount);
    }

    /// @notice Pay a losing challenger's stake to a beneficiary the arbiter names —
    ///         typically the desk that was falsely challenged, otherwise the treasury.
    /// @dev    Requires a prior public freeze plus `SLASH_DELAY`, so funds can never
    ///         move without an on-chain warning.
    function slash(string memory target, uint256 index, address beneficiary)
        external
        onlyArbiter
        nonReentrant
    {
        require(beneficiary != address(0), "Beneficiary required");

        Attest storage stake = _stakeAt(target, index);
        require(stake.status == StakeStatus.Active, "Stake already closed");
        require(stake.frozenAt != 0, "Freeze before slashing");
        require(block.timestamp >= stake.frozenAt + SLASH_DELAY, "Slash delay not elapsed");
        // Sit on a freeze too long and the stake stops being slashable at all.
        require(
            block.timestamp < stake.firstFrozenAt + MAX_FREEZE_DURATION,
            "Freeze expired"
        );

        address staker = stake.staker;
        uint256 amount = _closeStake(target, stake, StakeStatus.Slashed);

        require(IERC20(USDC).transfer(beneficiary, amount), "Slash transfer failed");
        emit StakeSlashed(target, index, staker, beneficiary, amount);
    }

    function proposeArbiter(address next) external onlyArbiter {
        require(next != address(0), "Invalid arbiter");
        pendingArbiter = next;
        emit ArbiterProposed(arbiter, next);
    }

    function acceptArbiter() external {
        require(msg.sender == pendingArbiter, "Not the pending arbiter");

        address previous = arbiter;
        arbiter = pendingArbiter;
        pendingArbiter = address(0);
        emit ArbiterTransferred(previous, arbiter);
    }

    function getAttestations(string memory target) external view returns (Attest[] memory) {
        return attestations[target];
    }

    function attestationCount(string memory target) external view returns (uint256) {
        return attestations[target].length;
    }

    /// @notice Whether `withdraw` would succeed right now for this stake.
    function isWithdrawable(string memory target, uint256 index) external view returns (bool) {
        Attest[] storage list = attestations[target];
        if (index >= list.length) return false;

        Attest storage stake = list[index];
        return
            stake.status == StakeStatus.Active &&
            stake.frozenAt == 0 &&
            block.timestamp >= stake.unlockAt;
    }

    /// @notice Whether `reclaimExpiredFreeze` would succeed right now for this stake.
    function isReclaimable(string memory target, uint256 index) external view returns (bool) {
        Attest[] storage list = attestations[target];
        if (index >= list.length) return false;

        Attest storage stake = list[index];
        return
            stake.status == StakeStatus.Active &&
            stake.frozenAt != 0 &&
            block.timestamp >= stake.firstFrozenAt + MAX_FREEZE_DURATION &&
            block.timestamp >= stake.unlockAt;
    }

    /// @dev Effects for every exit path: terminal status and balance bookkeeping,
    ///      always applied before the token transfer.
    function _closeStake(string memory target, Attest storage stake, StakeStatus status)
        private
        returns (uint256 amount)
    {
        amount = stake.amount;
        stake.status = status;
        totalStaked[target] -= amount;
        totalEscrowed -= amount;
    }

    function _stakeAt(string memory target, uint256 index)
        private
        view
        returns (Attest storage)
    {
        Attest[] storage list = attestations[target];
        require(index < list.length, "No such attestation");
        return list[index];
    }
}

pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "./library/BasisPoints.sol";
import "./library/PoolManagerRole.sol";
import "./MoonTokenV2.sol";


contract MoonStaking is Initializable, PoolManagerRole, Ownable {
    using BasisPoints for uint;
    using SafeMath for uint;

    uint256 constant internal DISTRIBUTION_MULTIPLIER = 2 ** 64;

    uint public taxBP;
    uint public burnBP;
    uint public refBP;

    uint public referralPayoutBP;

    MoonTokenV2 private moonToken;

    mapping(address => uint) public stakeValue;
    mapping(address => int) private stakerPayouts;

    mapping(address => address) public stakerRefferers;
    mapping(address => uint) public referralPayouts;
    uint public referralPoolReserved;
    uint public referralPool;

    uint public startTime;

    uint public totalDistributions;
    uint public totalStaked;
    uint public totalStakers;
    uint private profitPerShare;
    uint private emptyStakeTokens; //These are tokens given to the contract when there are no stakers.

    event OnDistribute(address sender, uint amountSent);
    event OnReferralDistribute(address sender, uint amount);
    event OnStake(address sender, uint amount, address refferer);
    event OnUnstake(address sender, uint amount, uint taxTokens, uint burnTokens, uint referralTokens);
    event OnReinvest(address sender, uint amount);
    event OnWithdraw(address sender, uint amount);
    event OnReferralClaim(address sender, uint amount);
    event OnReferralExcessClaim(address sender, uint amount);

    modifier onlyMoonToken {
        require(msg.sender == address(moonToken), "Can only be called by MoonTokenV2 contract.");
        _;
    }

    modifier whenStakingActive {
        require(now > startTime, "Staking not yet started.");
        _;
    }

    function initialize(
        uint _startTime,
        uint _taxBP,
        uint _burnBP,
        uint _refBP,
        uint _referralPayoutBP,
        address _owner,
        address[] memory _poolManagers,
        MoonTokenV2 _moonToken
    ) public initializer {
        Ownable.initialize(msg.sender);

        startTime = _startTime;
        moonToken = _moonToken;

        taxBP = _taxBP;
        burnBP = _burnBP;
        refBP = _refBP;
        referralPayoutBP = _referralPayoutBP;

        PoolManagerRole.initialize(address(this));
        _removePoolManager(address(this));

        for (uint256 i = 0; i < _poolManagers.length; ++i) {
            _addPoolManager(_poolManagers[i]);
        }

        //Due to issue in oz testing suite, the msg.sender might not be owner
        _transferOwnership(_owner);
    }

    function stake(uint amount) public whenStakingActive {
        if (stakerRefferers[msg.sender] != address(0x0)) {
            stakeWithReferrer(amount, stakerRefferers[msg.sender]);
        } else {
            stakeWithReferrer(amount, address(0x0));
        }
    }

    function stakeWithReferrer(uint amount, address referrer) public whenStakingActive {
        require(amount >= 10000e18, "Must stake at least 10000 MOON.");
        require(moonToken.balanceOf(msg.sender) >= amount, "Cannot stake more MOON than you hold unstaked.");
        if (stakerRefferers[msg.sender] != address(0x0)) {
            referrer = stakerRefferers[msg.sender]; //User cannot change their referrer.
        }
        if (referrer != address(0x0)) {
            //NOTE: The referral pool gets refreshed from all tx.
            //So at certain points, may be low/empty.
            //In which case rewards will need to wait to be pulled.
            uint referralAmount = amount.mulBP(refBP);
            referralPayouts[referrer] = referralPayouts[referrer].add(referralAmount);
            referralPoolReserved = referralPoolReserved.add(referralAmount);
        }
        if (stakeValue[msg.sender] == 0) totalStakers = totalStakers.add(1);
        _addStake(amount);
        require(moonToken.transferFrom(msg.sender, address(this), amount), "Stake failed due to failed transfer.");
        emit OnStake(msg.sender, amount, referrer);
    }

    function unstake(uint amount) public whenStakingActive {
        require(amount >= 1e18, "Must unstake at least one MOON.");
        require(stakeValue[msg.sender] >= amount, "Cannot unstake more MOON than you have staked.");

        (uint taxTokens, uint burnTokens, uint referralTokens) = taxAmount(amount);
        uint earnings = amount.sub(taxTokens).sub(burnTokens).sub(referralTokens);

        if (stakeValue[msg.sender] == amount) totalStakers = totalStakers.sub(1);
        totalStaked = totalStaked.sub(amount);
        stakeValue[msg.sender] = stakeValue[msg.sender].sub(amount);
        uint payout = profitPerShare.mul(amount).add(taxTokens.mul(DISTRIBUTION_MULTIPLIER));
        stakerPayouts[msg.sender] = stakerPayouts[msg.sender] - uintToInt(payout);

        _increaseProfitPerShare(taxTokens);
        moonToken.burn(burnTokens);
        referralPool.add(referralTokens);
        emit OnReferralDistribute(msg.sender, amount);

        require(moonToken.transferFrom(address(this), msg.sender, earnings), "Unstake failed due to failed transfer.");
        emit OnUnstake(msg.sender, amount, taxTokens, burnTokens, referralTokens);
    }

    function withdraw(uint amount) public whenStakingActive {
        require(dividendsOf(msg.sender) >= amount, "Cannot withdraw more dividends than you have earned.");
        stakerPayouts[msg.sender] = stakerPayouts[msg.sender] + uintToInt(amount.mul(DISTRIBUTION_MULTIPLIER));
        moonToken.transfer(msg.sender, amount);
        emit OnWithdraw(msg.sender, amount);
    }

    function reinvest(uint amount) public whenStakingActive {
        require(dividendsOf(msg.sender) >= amount, "Cannot reinvest more dividends than you have earned.");
        uint payout = amount.mul(DISTRIBUTION_MULTIPLIER);
        stakerPayouts[msg.sender] = stakerPayouts[msg.sender] + uintToInt(payout);
        _addStake(amount);
        emit OnReinvest(msg.sender, amount);
    }

    function distribute(uint amount) public {
        require(moonToken.balanceOf(msg.sender) >= amount, "Cannot distribute more MOON than you hold unstaked.");
        totalDistributions = totalDistributions.add(amount);
        _increaseProfitPerShare(amount);
        require(
            moonToken.transferFrom(msg.sender, address(this), amount),
            "Distribution failed due to failed transfer."
        );
        emit OnDistribute(msg.sender, amount);
    }

    function claimReferralRewards() public {
        uint amount = referralPayouts[msg.sender];
        require(amount != 0, "Must have referral rewards to claim.");
        require(amount < referralPool, "Not enough tokens in pool. Wait for a refresh.");
        referralPoolReserved = referralPoolReserved.sub(amount);
        referralPool = referralPool.sub(amount);
        referralPayouts[msg.sender] = 0;
        moonToken.transfer(msg.sender, amount);
        emit OnReferralClaim(msg.sender, amount);
    }

    function claimExcessFromReferralPool(uint amount) public onlyPoolManager {
        require(amount <= referralPool.sub(referralPoolReserved), "Amount is greater than excess.");
        referralPool = referralPool.sub(amount);
        moonToken.transfer(msg.sender, amount);
        emit OnReferralExcessClaim(msg.sender, amount);
    }

    function handleTaxDistribution(uint amount) public onlyMoonToken {
        totalDistributions = totalDistributions.add(amount);
        _increaseProfitPerShare(amount);
        emit OnDistribute(msg.sender, amount);
    }

    function handleReferralDistribution(uint amount) public onlyMoonToken {
        referralPool.add(amount);
        emit OnReferralDistribute(msg.sender, amount);
    }

    function setStartTime(uint val) public onlyOwner {
        startTime = val;
    }

    function dividendsOf(address staker) public view returns (uint) {
        return uint(uintToInt(profitPerShare.mul(stakeValue[staker])) - stakerPayouts[staker])
            .div(DISTRIBUTION_MULTIPLIER);
    }

    function taxAmount(uint value) public view returns (uint tax, uint burn, uint referral) {
        tax = value.mulBP(taxBP);
        burn = value.mulBP(burnBP);
        referral = value.mulBP(refBP);
        return (tax, burn, referral);
    }

    function uintToInt(uint val) internal pure returns (int) {
        if (val >= uint(-1).div(2)) {
            require(false, "Overflow. Cannot convert uint to int.");
        } else {
            return int(val);
        }
    }

    function _addStake(uint amount) internal {
        totalStaked = totalStaked.add(amount);
        stakeValue[msg.sender] = stakeValue[msg.sender].add(amount);
        uint payout = profitPerShare.mul(amount);
        stakerPayouts[msg.sender] = stakerPayouts[msg.sender] + uintToInt(payout);
    }

    function _increaseProfitPerShare(uint amount) internal {
        if (totalStaked != 0) {
            if (emptyStakeTokens != 0) {
                amount = amount.add(emptyStakeTokens);
                emptyStakeTokens = 0;
            }
            profitPerShare = profitPerShare.add(amount.mul(DISTRIBUTION_MULTIPLIER).div(totalStaked));
        } else {
            emptyStakeTokens = emptyStakeTokens.add(amount);
        }
    }

}

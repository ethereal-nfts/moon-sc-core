pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "./library/BasisPoints.sol";
import "./library/BonusWhitelistRole.sol";
import "./MoonTokenV2.sol";


contract MoonV2Swap is BonusWhitelistRole, Ownable {
    using BasisPoints for uint;
    using SafeMath for uint;

    ERC20Burnable private moonTokenV1;
    MoonTokenV2 private moonTokenV2;

    uint public bonusBP;
    mapping(address => uint) public bonusWhitelist;
    mapping(address => uint) public bonusClaimed;

    mapping(address => bool) public isEarlySwapWhitelist;

    uint public startTime;

    modifier whenSwapActiveOrEarlyWhitelist {
        require(
            (now > startTime) ||
            isEarlySwapWhitelist[msg.sender]
            , "Swap not yet started."
        );
        _;
    }

    event OnSwap(address swapper, uint v1Burned, uint v2Minted);

    function initialize(
        uint _startTime,
        uint _bonusBP,
        address _owner,
        address[] memory _bonusWhitelistAdmins,
        address[] memory _isEarlySwapWhitelist,
        ERC20Burnable _moonTokenV1,
        MoonTokenV2 _moonTokenV2
    ) public initializer {
        Ownable.initialize(msg.sender);

        moonTokenV1 = _moonTokenV1;
        moonTokenV2 = _moonTokenV2;
        bonusBP = _bonusBP;
        startTime = _startTime;

        BonusWhitelistRole.initialize(address(this));
        _removeBonusWhitelist(address(this));

        for (uint256 i = 0; i < _bonusWhitelistAdmins.length; ++i) {
            _addBonusWhitelist(_bonusWhitelistAdmins[i]);
        }

        for (uint256 i = 0; i < _bonusWhitelistAdmins.length; ++i) {
            _setIsEarlySwapWhitelist(_isEarlySwapWhitelist[i], true);
        }

        //Due to issue in oz testing suite, the msg.sender might not be owner
        _transferOwnership(_owner);
    }

    function swapAll() public {
        swap(moonTokenV1.balanceOf(msg.sender));
    }

    function swap(uint amount) public whenSwapActiveOrEarlyWhitelist {
        require(amount > 0, "Must swap at least 1 wei of MoonV1.");
        //NOTE: Requires MoonV2Swap have Minter role on MoonTokenV2.
        //NOTE: Requires user has approved MoonV1 for burnFrom.
        require(amount <= moonTokenV1.balanceOf(msg.sender), "Cannot swap more than balance.");
        moonTokenV1.burnFrom(msg.sender, amount);

        uint bonus = 0;
        if (bonusWhitelist[msg.sender] > bonusClaimed[msg.sender]) {
            uint maxBonus = bonusWhitelist[msg.sender];
            uint claimedBonus = bonusClaimed[msg.sender];
            if (amount <= maxBonus.sub(claimedBonus)) {
                bonus = amount.mulBP(bonusBP);
                bonusClaimed[msg.sender] = claimedBonus.add(amount);
            } else {
                bonus = maxBonus.sub(claimedBonus).mulBP(bonusBP);
                bonusClaimed[msg.sender] = 0;
            }
        }

        uint toMint = amount.add(bonus);
        moonTokenV2.mint(msg.sender, toMint);
        emit OnSwap(msg.sender, amount, toMint);
    }

    function setBonus(address receiver, uint amount) public onlyBonusWhitelist {
        bonusWhitelist[receiver] = amount;
    }

    function setBonusMulti(address[] memory receivers, uint[] memory amounts) public onlyBonusWhitelist {
        require(receivers.length == amounts.length, "Must have same number of addresses as amounts.");
        for (uint i=0; i < receivers.length; i++) {
            bonusWhitelist[receivers[i]] = amounts[i];
        }
    }

    function setIsEarlySwapWhitelist(address account, bool val) public onlyOwner {
        _setIsEarlySwapWhitelist(account, val);
    }

    function setStartTime(uint val) public onlyOwner {
        startTime = val;
    }

    function _setIsEarlySwapWhitelist(address account, bool val) internal {
        isEarlySwapWhitelist[account] = val;
    }


}

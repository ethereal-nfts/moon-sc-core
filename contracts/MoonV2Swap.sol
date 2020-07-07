pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./library/BasisPoints.sol";
import "./library/BonusWhitelistRole.sol";
import "./MoonTokenV2.sol";


contract MoonV2Swap is BonusWhitelistRole {
    using BasisPoints for uint;
    using SafeMath for uint;

    ERC20Burnable private moonTokenV1;
    MoonTokenV2 private moonTokenV2;

    uint public bonusBP;
    mapping(address => uint) public bonusWhitelist;
    mapping(address => uint) public bonusClaimed;

    event OnSwap(address swapper, uint v1Burned, uint v2Minted);

    function initialize(
        ERC20Burnable _moonTokenV1,
        MoonTokenV2 _moonTokenV2,
        uint _bonusBP,
        address[] memory _bonusWhitelistAdmins
    ) public initializer {
        moonTokenV1 = _moonTokenV1;
        moonTokenV2 = _moonTokenV2;
        bonusBP = _bonusBP;

        BonusWhitelistRole.initialize(address(this));
        _removeBonusWhitelist(address(this));

        for (uint256 i = 0; i < _bonusWhitelistAdmins.length; ++i) {
            _addBonusWhitelist(_bonusWhitelistAdmins[i]);
        }
    }

    function swapAll() public {
        swap(moonTokenV1.balanceOf(msg.sender));
    }

    function swap(uint amount) public {
        require(amount > 0, "Must swap at least 1 wei of MoonV1.");
        //NOTE: Requires MoonV2Swap have Minter role on MoonTokenV2.
        //NOTE: Requires user has approved MoonV2Swap to transfer MoonV1 tokens.
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
}

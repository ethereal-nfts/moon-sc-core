pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./library/BasisPoints.sol";
import "./MoonStaking.sol";


contract MoonTokenV2 is Initializable, Ownable, ERC20Burnable, ERC20Detailed {
    using BasisPoints for uint;
    using SafeMath for uint;

    uint public taxBP;
    uint public burnBP;
    uint public refBP;
    uint public bonusBP;

    MoonStaking private moonStaking;

    bool public isAirdropComplete;

    mapping(address => bool) private trustedContracts;
    mapping(address => bool) private bonusWhitelist;

    function initialize(
        string memory name, string memory symbol, uint8 decimals,
        uint _taxBP, uint _burnBP, uint _refBP, uint _bonusBP, address _owner,
        MoonStaking _moonStaking
    ) public initializer {
        Ownable.initialize(msg.sender);

        taxBP = _taxBP;
        burnBP = _burnBP;
        refBP = _refBP;
        bonusBP = _bonusBP;

        moonStaking = _moonStaking;

        ERC20Detailed.initialize(name, symbol, decimals);

        //Due to issue in oz testing suite, the msg.sender might not be owner
        _transferOwnership(_owner);
    }

    function taxAmount(uint value) public view returns (uint tax, uint burn, uint referral) {
        tax = value.mulBP(taxBP);
        burn = value.mulBP(burnBP);
        referral = value.mulBP(refBP);
        return (tax, burn, referral);
    }

    function transfer(address recipient, uint amount) public returns (bool) {
        _transferWithTax(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint amount) public returns (bool) {
        _transferWithTax(sender, recipient, amount);
        //Moonstaking SC is trusted, no approve required
        if (msg.sender == address(moonStaking)) return true;
        approve
        (
            msg.sender,
            allowance(
                sender,
                msg.sender
            ).sub(amount, "Transfer amount exceeds allowance")
        );
        return true;
    }

    function setBonusWhitelist(address receiver, bool val) public onlyOwner {
        bonusWhitelist[receiver] = val;
    }

    function grantBonusWhitelistMulti(address[] memory receivers) public onlyOwner {
        for (uint i=0; i < receivers.length; i++) {
            bonusWhitelist[receivers[i]] = true;
        }
    }

    function airdrop(address[] memory receivers, uint[] memory amounts) public onlyOwner {
        require(receivers.length == amounts.length, "Must have same number of addresses as amounts.");
        require(!isAirdropComplete, "Airdrop has ended.");
        for (uint i=0; i < receivers.length; i++) {
            _airdrop(receivers[i], amounts[i]);
        }
        require(totalSupply() <= 250000000 ether, "Cannot issue more than cap.");
    }

    function setAirdropComplete() public onlyOwner {
        isAirdropComplete = true;
    }

    function _airdrop(address receiver, uint amount) internal {
        require(balanceOf(receiver) == 0, "Receiver must not have been airdropped tokens.");
        if (bonusWhitelist[receiver]) {
            _mint(receiver, amount.addBP(bonusBP));
        } else {
            _mint(receiver, amount);
        }
    }

    function _transferWithTax(address sender, address recipient, uint amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        (uint taxTokens, uint burnTokens, uint referralTokens) = taxAmount(amount);
        uint tokensToTransfer = amount.sub(taxTokens).sub(burnTokens).sub(referralTokens);

        _transfer(sender, address(moonStaking), taxTokens.add(referralTokens));
        _burn(sender, burnTokens);
        _transfer(sender, recipient, tokensToTransfer);
        moonStaking.handleTaxDistribution(taxTokens);
        moonStaking.handleReferralDistribution(referralTokens);
    }
}

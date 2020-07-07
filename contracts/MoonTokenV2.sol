pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./library/BasisPoints.sol";
import "./MoonStaking.sol";


contract MoonTokenV2 is Initializable, ERC20Burnable, ERC20Mintable, ERC20Pausable, ERC20Detailed, Ownable {
    using BasisPoints for uint;
    using SafeMath for uint;

    uint public taxBP;
    uint public burnBP;
    uint public refBP;

    MoonStaking private moonStaking;

    mapping(address => bool) private trustedContracts;

    function initialize(
        string memory name, string memory symbol, uint8 decimals, address owner,
        uint _taxBP, uint _burnBP, uint _refBP,
        MoonStaking _moonStaking
    ) public initializer {
        taxBP = _taxBP;
        burnBP = _burnBP;
        refBP = _refBP;

        Ownable.initialize(msg.sender);

        ERC20Detailed.initialize(name, symbol, decimals);

        ERC20Mintable.initialize(address(this));
        _removeMinter(address(this));
        _addMinter(owner);

        ERC20Pausable.initialize(address(this));
        _removePauser(address(this));
        _addPauser(owner);

        moonStaking = _moonStaking;

        //Due to issue in oz testing suite, the msg.sender might not be owner
        _transferOwnership(owner);
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
        if (address == address(moonStaking)) return true; //Moonstaking SC is trusted, no approve required
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

    function _transferWithTax(address sender, address recipient, uint amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        (uint taxTokens, uint burnTokens, uint referralTokens) = taxAmount(amount);
        uint tokensToTransfer = amount.sub(taxTokens).sub(burnTokens).sub(referralTokens);

        _transfer(sender, address(moonStaking), taxTokens.add(referralTokens));
        burn(burnTokens);
        _transfer(sender, recipient, tokensToTransfer);
        moonStaking.handleTaxDistribution(taxTokens);
        moonStaking.handleReferralDistribution(referralTokens);
    }
}

pragma solidity ^0.5.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Roles.sol";


contract BonusWhitelistRole is Initializable {
    using Roles for Roles.Role;

    event BonusWhitelistAdded(address indexed account);
    event BonusWhitelistRemoved(address indexed account);

    Roles.Role private _bonusWhitelists;

    function initialize(address sender) public initializer {
        if (!isBonusWhitelist(sender)) {
            _addBonusWhitelist(sender);
        }
    }

    modifier onlyBonusWhitelist() {
        require(isBonusWhitelist(msg.sender), "BonusWhitelistRole: caller does not have the BonusWhitelist role");
        _;
    }

    function isBonusWhitelist(address account) public view returns (bool) {
        return _bonusWhitelists.has(account);
    }

    function addBonusWhitelist(address account) public onlyBonusWhitelist {
        _addBonusWhitelist(account);
    }

    function renounceBonusWhitelist() public {
        _removeBonusWhitelist(msg.sender);
    }

    function _addBonusWhitelist(address account) internal {
        _bonusWhitelists.add(account);
        emit BonusWhitelistAdded(account);
    }

    function _removeBonusWhitelist(address account) internal {
        _bonusWhitelists.remove(account);
        emit BonusWhitelistRemoved(account);
    }

    uint256[50] private ______gap;
}

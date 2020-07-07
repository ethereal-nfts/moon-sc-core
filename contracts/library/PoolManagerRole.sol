pragma solidity ^0.5.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Roles.sol";


contract PoolManagerRole is Initializable {
    using Roles for Roles.Role;

    event PoolManagerAdded(address indexed account);
    event PoolManagerRemoved(address indexed account);

    Roles.Role private _poolManagers;

    function initialize(address sender) public initializer {
        if (!isPoolManager(sender)) {
            _addPoolManager(sender);
        }
    }

    modifier onlyPoolManager() {
        require(isPoolManager(msg.sender), "PoolManagerRole: caller does not have the PoolManager role");
        _;
    }

    function isPoolManager(address account) public view returns (bool) {
        return _poolManagers.has(account);
    }

    function addPoolManager(address account) public onlyPoolManager {
        _addPoolManager(account);
    }

    function renouncePoolManager() public {
        _removePoolManager(msg.sender);
    }

    function _addPoolManager(address account) internal {
        _poolManagers.add(account);
        emit PoolManagerAdded(account);
    }

    function _removePoolManager(address account) internal {
        _poolManagers.remove(account);
        emit PoolManagerRemoved(account);
    }

    uint256[50] private ______gap;
}

pragma solidity 0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";


contract Mock_MoonTokenV1 is Ownable, ERC20Mintable, ERC20Burnable {
    function initialize(
        address _owner
    ) public initializer {
        Ownable.initialize(msg.sender);

        ERC20Mintable.initialize(address(this));
        _removeMinter(address(this));
        _addMinter(_owner);

        //Due to issue in oz testing suite, the msg.sender might not be owner
        _transferOwnership(_owner);
    }
}

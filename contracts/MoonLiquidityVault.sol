pragma solidity ^0.5.16;
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";


/**
 *
 * Moon's Liquidity Vault, derived from Mammoth Liquidity Vault.
 *
 * Simple smart contract to decentralize the uniswap liquidity, providing proof of liquidity indefinitely.
 *
 */
contract MoonLiquidityVault {
    IERC20 public constant LIQ_TOKEN = IERC20(0x7bbE4e44Cd5b4e3C53B7D2E90fb525E5614FE031);
    address public owner;
    uint public migrationLock;
    address public migrationRecipient;

    constructor () public {
        owner = msg.sender;
    }

    /**
     * This contract is just a simple initial decentralization of the liquidity
     * (to squell the skeptics) in future may need to migrate to more advanced decentralization (DAO etc.)
     * So this function allows liquidity to be moved, after a 14 days lockup -preventing abuse.

    function startLiquidityMigration(address recipient) external {
        require(msg.sender == owner);
        migrationLock = now + 14 days;
        migrationRecipient = recipient;
    }

    /**
     * Moves liquidity to new location, assuming the 14 days lockup has passed -preventing abuse.
     
    function processMigration() external {
        require(msg.sender == owner);
        require(migrationRecipient != address(0));
        require(now > migrationLock);

        uint256 liquidityBalance = liquidityToken.balanceOf(address(this));
        liquidityToken.transfer(migrationRecipient, liquidityBalance);
    }
    */

}

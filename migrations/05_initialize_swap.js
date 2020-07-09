const { scripts, ConfigManager } = require("@openzeppelin/cli")
const { add, push, create } = scripts
const {publicKey} = require("../privatekey")

const config = require("../config")

const MoonTokenV2 = artifacts.require("MoonTokenV2")
const MoonStaking = artifacts.require("MoonStaking")
const MoonV2Swap = artifacts.require("MoonV2Swap")

async function initialize(accounts,networkName) {
  let owner = accounts[0]

  const tokenParams =   config.MoonTokenV2
  const stakingParams = config.MoonStaking
  const swapParams = config.MoonV2Swap

  const moonToken =   await MoonTokenV2.deployed()
  const moonStaking = await MoonStaking.deployed()
  const moonSwap = await MoonV2Swap.deployed()

  await moonToken.initialize(
    tokenParams.name,
    tokenParams.symbol,
    tokenParams.decimals,
    tokenParams.taxBP,
    tokenParams.burnBP,
    tokenParams.refBP,
    moonStaking.address,
    moonSwap.address
  )

  await moonStaking.initialize(
    stakingParams.startTime,
    stakingParams.taxBP,
    stakingParams.burnBP,
    stakingParams.refBP,
    stakingParams.referralPayoutBP,
    owner,
    stakingParams.referralPoolAdmins,
    moonToken.address
  )

  await moonSwap.initialize(
    swapParams.startTime,
    swapParams.bonusBP,
    owner,
    swapParams.whitelistBonusAdmins,
    swapParams.earlySwapWhitelist,
    swapParams.moonV1Address,
    moonTokenV2.address
  )

}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    await initialize(accounts,networkName)
  })
}

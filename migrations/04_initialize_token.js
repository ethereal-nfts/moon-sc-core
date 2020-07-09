const { scripts, ConfigManager } = require("@openzeppelin/cli")
const { add, push, create } = scripts
const {publicKey} = require("../privatekey")

const config = require("../config")

const MoonTokenV2 = artifacts.require("MoonTokenV2")
const MoonStaking = artifacts.require("MoonStaking")

async function initialize(accounts,networkName) {
  let owner = accounts[0]

  const tokenParams =   config.MoonTokenV2
  const stakingParams = config.MoonStaking

  const moonToken =   await MoonTokenV2.deployed()
  const moonStaking = await MoonStaking.deployed()

  await this.moonStaking.initialize(
    stakingParams.startTime,
    stakingParams.taxBP,
    stakingParams.burnBP,
    stakingParams.refBP,
    stakingParams.referralPayoutBP,
    owner,
    stakingParams.referralPoolAdmins,
    moonToken.address
  )

  await this.moonToken.initialize(
    tokenParams.name,
    tokenParams.symbol,
    tokenParams.decimals,
    tokenParams.taxBP,
    tokenParams.burnBP,
    tokenParams.refBP,
    tokenParams.bonusBP,
    owner,
    moonStaking.address
  )

}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    await initialize(accounts,networkName)
  })
}

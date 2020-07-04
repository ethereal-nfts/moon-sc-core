const { scripts, ConfigManager } = require("@openzeppelin/cli")
const { add, push, create } = scripts
const {publicKey} = require("../privatekey")

const config = require("../config")

const MoonToken = artifacts.require("MoonToken")
const MoonStaking = artifacts.require("MoonStaking")
const MoonPresale = artifacts.require("MoonPresale")

async function initialize(accounts,networkName) {
  let owner = accounts[0]

  const tokenParams =   config.MoonToken
  const stakingParams = config.MoonStaking
  const presaleParams = config.MoonPresale
  const launchParams =  config.Launch

  const moonToken =   await MoonToken.deployed()
  const moonStaking = await MoonStaking.deployed()
  const moonPresale = await MoonPresale.deployed()

  await moonToken.initialize(
    tokenParams.name,
    tokenParams.symbol,
    tokenParams.decimals,
    owner,
    tokenParams.taxBP,
    moonStaking.address
  )

  await moonStaking.initialize(
    stakingParams.stakingTaxBP,
    stakingParams.unstakingTaxBP,
    owner,
    moonToken.address
  )

  await moonToken.mint(
    moonPresale.address,
    presaleParams.totalPresaleTokens.add(presaleParams.totalUniswapTokens)
  )

  await moonPresale.initialize(
    presaleParams.buybackBP,
    presaleParams.devfundBP,
    presaleParams.maxBuyPerAddress,
    presaleParams.maximumPresaleEther,
    presaleParams.requiresWhitelisting,
    presaleParams.totalPresaleTokens,
    presaleParams.totalUniswapTokens,
    owner,
    moonToken.address
  )

  moonPresale.setStartTime(launchParams.startTime.toString(),{from:owner})

}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    await initialize(accounts,networkName)
  })
}

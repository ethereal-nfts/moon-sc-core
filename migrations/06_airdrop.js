const { scripts, ConfigManager } = require("@openzeppelin/cli")
const { add, push, create } = scripts
const {publicKey} = require("../privatekey")

const config = require("../config")
const airdrop = require("../airdrop")
const bonusWhitelist = require("../bonusWhitelist")

const MoonTokenV2 = artifacts.require("MoonTokenV2")

async function airdrop(accounts,networkName) {
  let owner = accounts[0]

  const moonToken = await MoonTokenV2.deployed()

  const addresses = aidrop.map((elem)=>elem.HolderAddress)
  const balances = aidrop.map((elem)=>elem.Balance)

  await moonToken.airdrop(
    addresses,
    balances,
    {from:owner}
  )

}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    await airdrop(accounts,networkName)
  })
}

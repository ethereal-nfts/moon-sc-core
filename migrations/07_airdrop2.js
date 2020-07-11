const { scripts, ConfigManager } = require("@openzeppelin/cli")
const { add, push, create } = scripts
const {publicKey} = require("../privatekey")
const { web3 } = require("@openzeppelin/test-environment")

const config = require("../config")
const airdrop = require("../airdrop")
const bonusWhitelist = require("../bonusWhitelist")

const MoonTokenV2 = artifacts.require("MoonTokenV2")

async function airdropCall(accounts,networkName) {
  let owner = accounts[0]

  const moonToken = await MoonTokenV2.deployed()

  const addresses = airdrop.map((elem)=>elem.HolderAddress)
  console.log(addresses.length)
  const balances = airdrop.map((elem)=>web3.utils.toWei(elem.Balance.toString()))
  console.log(balances.length)

  await moonToken.airdrop(
    addresses.slice(addresses.length/2),
    balances.slice(addresses.length/2),
    {from:owner}
  )

}

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    await airdropCall(accounts,networkName)
  })
}

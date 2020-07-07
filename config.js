const { ether } = require("@openzeppelin/test-helpers")

let config = {}

config.MoonToken = {
  name:"MoonCoin",
  symbol:"MOON",
  decimals:18,
  taxBP:400,
  burnBP:400,
  refBP:400
}

config.MoonStaking = {
  stakingTaxBP: 100,
  unstakingTaxBP: 100,
  startTime: 1593918000
}

config.MoonV2Swap = {
  bonusBP: 2000,
  whitelistBonusAdmins: [

  ]
}

config.Launch = {
  startTime: 1593696600
}
module.exports = config

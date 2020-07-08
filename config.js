const { ether } = require("@openzeppelin/test-helpers")

let config = {}

config.MoonTokenV2 = {
  name:"MoonCoin",
  symbol:"MOON",
  decimals:18,
  taxBP:400,
  burnBP:400,
  refBP:200
}

config.MoonStaking = {
  startTime: 1594375200,
  taxBP: 400,
  burnBP: 400,
  refBP: 200,
  referralPayoutBP: 200,
  referralPoolAdmins: [
    
  ]
}

config.MoonV2Swap = {
  bonusBP: 2000,
  whitelistBonusAdmins: [

  ]
}

config.Launch = {
  startTime: 1594375200
}
module.exports = config

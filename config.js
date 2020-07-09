const { ether } = require("@openzeppelin/test-helpers")

let config = {}

config.MoonTokenV2 = {
  name:"MoonCoin",
  symbol:"MOON",
  decimals:18,
  taxBP:400,
  burnBP:400,
  refBP:200,
  bonusBP: 2000,
}

config.MoonStaking = {
  startTime: 1594548000,
  taxBP: 400,
  burnBP: 400,
  refBP: 200,
  referralPayoutBP: 200,
  referralPoolAdmins: [
    "0xe50CdD51908045EA6b392437f88E14935281Cb94",
    "0x54c993c4506ba3051117f77ff9ddf9b414a9c5ed",
    "0xb068EA36be1eE893f9538855dA6d206F19dce218"
  ],
}

module.exports = config

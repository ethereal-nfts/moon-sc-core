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
  startTime: 1594461600,
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

config.MoonV2Swap = {
  startTime: 1594375200,
  bonusBP: 2000,
  whitelistBonusAdmins: [
    "0xe50CdD51908045EA6b392437f88E14935281Cb94",
    "0x54c993c4506ba3051117f77ff9ddf9b414a9c5ed",
    "0xb068EA36be1eE893f9538855dA6d206F19dce218"
  ],
  earlySwapWhitelist: [
    "0x3a0b7fe42b0cbe9778e85e831e8c128c54ee95e3",
    "0x905c5ebfc841f457aead74757086b948c1fb194e",
    "0x52586260bc7b2504a8cc8ebcb267bf687110f3a7",
  ],
  moonV1Address: "0x94b86C1F3682D6e87a84bCD9E2d281286CB7A904"
}
module.exports = config

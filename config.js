const { ether } = require("@openzeppelin/test-helpers")

let config = {}

config.MoonToken = {
  name:"MoonCoin",
  symbol:"MOON",
  decimals:18,
  taxBP:100
}

config.MoonStaking = {
  stakingTaxBP: 100,
  unstakingTaxBP: 100,
  startTime: 1593918000
}

config.MoonPresale = {
  buybackBP: 1500,
  devfundBP: 1000,
  maxBuyPerAddress: ether("5"),
  maximumPresaleEther: ether("200"),
  requiresWhitelisting: true,
  totalPresaleTokens: ether("40000000"),
  totalUniswapTokens: ether("24000000")
}

config.Launch = {
  startTime: 1593696600
}
module.exports = config

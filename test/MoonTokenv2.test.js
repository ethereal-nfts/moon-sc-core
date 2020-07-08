const { accounts, contract, web3 } = require("@openzeppelin/test-environment")
const { expectRevert, time, BN, ether, balance } = require("@openzeppelin/test-helpers")
const {expect} = require("chai")
const config = require("../config")

const MoonTokenV2 = contract.fromArtifact("MoonTokenV2")
const MoonStaking = contract.fromArtifact("MoonStaking")
const MoonV2Swap = contract.fromArtifact("MoonV2Swap")
const Mock_MoonTokenV1 = contract.fromArtifact("Mock_MoonTokenV1")

const owner = accounts[0]
const transferFromAccounts = [accounts[1],accounts[2],accounts[3],accounts[9]]
const transferToAccounts = [accounts[4],accounts[5],accounts[6],accounts[10]]
const emptyAccount = accounts[7]
const approvedSender = accounts[8]

describe("MoonTokenV2", function() {
  before(async function() {
    const tokenParams = config.MoonTokenV2
    const stakingParams = config.MoonStaking
    const swapParams = config.MoonV2Swap

    this.moonTokenV2 = await MoonTokenV2.new()
    this.moonTokenV1 = await Mock_MoonTokenV1.new()
    this.moonStaking = await MoonStaking.new()
    this.moonV2Swap  = await MoonV2Swap.new()

    await this.moonTokenV1.initialize(owner)

    await this.moonTokenV2.initialize(
      tokenParams.name,
      tokenParams.symbol,
      tokenParams.decimals,
      tokenParams.taxBP,
      tokenParams.burnBP,
      tokenParams.refBP,
      this.moonStaking.address,
      this.moonV2Swap.address
    )

    await this.moonStaking.initialize(
      stakingParams.startTime,
      stakingParams.taxBP,
      stakingParams.burnBP,
      stakingParams.refBP,
      stakingParams.referralPayoutBP,
      stakingParams.referralPoolAdmins,
      this.moonTokenV2.address
    )

    this.moonV2Swap.initialize(
      swapParams.bonusBP,
      swapParams.whitelistBonusAdmins,
      this.moonTokenV1.address,
      this.moonTokenV2.address
    )

    await Promise.all([
      this.moonTokenV1.mint(transferFromAccounts[0],ether('10'),{from: owner}),
      this.moonTokenV1.mint(transferFromAccounts[1],ether('10'),{from: owner}),
      this.moonTokenV1.mint(transferFromAccounts[2],ether('10'),{from: owner}),
      this.moonTokenV1.mint(transferFromAccounts[3],ether('10'),{from: owner})
    ])

    await Promise.all([
      this.moonTokenV1.approve(this.moonV2Swap.address,ether('10'),{from: transferFromAccounts[0]}),
      this.moonTokenV1.approve(this.moonV2Swap.address,ether('10'),{from: transferFromAccounts[1]}),
      this.moonTokenV1.approve(this.moonV2Swap.address,ether('10'),{from: transferFromAccounts[2]}),
      this.moonTokenV1.approve(this.moonV2Swap.address,ether('10'),{from: transferFromAccounts[3]})
    ])

    await Promise.all([
      this.moonV2Swap.swap(ether('10'),{from: transferFromAccounts[0]}),
      this.moonV2Swap.swap(ether('10'),{from: transferFromAccounts[1]}),
      this.moonV2Swap.swap(ether('10'),{from: transferFromAccounts[2]}),
      this.moonV2Swap.swap(ether('10'),{from: transferFromAccounts[3]})
    ])

  })


  describe("#findTaxAmount", function(){
    it("Should return tax, burn, and referral at correct BasisPoints ratio.", async function() {
      const {tax, burn, referral} = await this.moonTokenV2.taxAmount(ether("10"))

      const expectedTax = ether("10").mul(new BN(config.MoonTokenV2.taxBP)).div(new BN(10000))
      const expectedBurn = ether("10").mul(new BN(config.MoonTokenV2.burnBP)).div(new BN(10000))
      const expectedRef = ether("10").mul(new BN(config.MoonTokenV2.refBP)).div(new BN(10000))

      expect(expectedTax.toString()).to.equal(tax.toString())
      expect(expectedBurn.toString()).to.equal(burn.toString())
      expect(expectedRef.toString()).to.equal(referral.toString())
    })
  })

  describe("#transfer", function(){
    //TODO: add tests to confirm burn
    it("Should revert if msg.sender sends more than their balance", async function() {
      await expectRevert(
        this.moonTokenV2.transfer(transferToAccounts[0],ether("10").add(new BN(1)),{from:transferFromAccounts[0]}),
        "ERC20: transfer amount exceeds balance"
      )
    })
    it("Should increase receiver by value minus tax+burn+referral.", async function() {
      const {tax, burn, referral} = await this.moonTokenV2.taxAmount(ether("1"))
      const receiver = transferToAccounts[0]
      const sender = transferFromAccounts[0]
      const receiverInitialBalance = await this.moonTokenV2.balanceOf(receiver)
      await this.moonTokenV2.transfer(receiver,ether("1"),{from:sender})
      const receiverFinalBalance = await this.moonTokenV2.balanceOf(receiver)
      expect(receiverFinalBalance.toString()).to.equal(receiverInitialBalance.add(ether("1")).sub(tax).sub(burn).sub(referral).toString())
    })
    it("Should decrease sender by value", async function() {
      const receiver = transferToAccounts[0]
      const sender = transferFromAccounts[0]
      const senderInitialBalance = await this.moonTokenV2.balanceOf(sender)
      await this.moonTokenV2.transfer(receiver,ether("1"),{from:sender})
      const senderFinalBalance = await this.moonTokenV2.balanceOf(sender)
      expect(senderFinalBalance.toString()).to.equal(senderInitialBalance.sub(ether("1")).toString())
    })
    it("Should increase staking contract by tax", async function() {
      const receiver = transferToAccounts[0]
      const sender = transferFromAccounts[0]
      const stakingInitialBalance = await this.moonTokenV2.balanceOf(this.moonStaking.address);
      await this.moonTokenV2.transfer(receiver,ether("1"),{from:sender})
      const {tax, burn, referral} = await this.moonTokenV2.taxAmount(ether("1"));
      const stakingFinalBalance = await this.moonTokenV2.balanceOf(this.moonStaking.address);
      expect(stakingFinalBalance.toString()).to.equal(stakingInitialBalance.add(tax).add(referral).toString())
    })
  })

  describe("#transferFrom", function(){
    //TODO: add tests to confirm burn
    before(async function() {
      await this.moonTokenV2.approve(approvedSender,ether("3"),{from:transferFromAccounts[1]})
    })
    it("Should revert if msg.sender does not have enough approved", async function() {
        const receiver = transferToAccounts[1]
        const sender = transferFromAccounts[1]
      await expectRevert(
        this.moonTokenV2.transferFrom(sender,receiver,ether("5").add(new BN(1)),{from:approvedSender}),
        "Transfer amount exceeds allowance"
      )
    })
    it("Should increase receiver by value minus tax+burn+referral", async function() {
      const {tax, burn, referral} = await this.moonTokenV2.taxAmount(ether("1"))
      const receiver = transferToAccounts[1]
      const sender = transferFromAccounts[1]
      const receiverInitialBalance = await this.moonTokenV2.balanceOf(receiver)
      await this.moonTokenV2.transferFrom(sender,receiver,ether("1"),{from:approvedSender})
      const receiverFinalBalance = await this.moonTokenV2.balanceOf(receiver)
      expect(receiverFinalBalance.toString()).to.equal(receiverInitialBalance.add(ether("1")).sub(tax).sub(burn).sub(referral).toString())
    })
    it("Should decrease sender by value", async function() {
      const receiver = transferToAccounts[1]
      const sender = transferFromAccounts[1]
      const senderInitialBalance = await this.moonTokenV2.balanceOf(sender)
      await this.moonTokenV2.transferFrom(sender,receiver,ether("1"),{from:approvedSender})
      const senderFinalBalance = await this.moonTokenV2.balanceOf(sender)
      expect(senderFinalBalance.toString()).to.equal(senderInitialBalance.sub(ether("1")).toString())
    })
    it("Should increase staking contract by tax+referral", async function() {
      const receiver = transferToAccounts[1]
      const sender = transferFromAccounts[1]
      const stakingInitialBalance = await this.moonTokenV2.balanceOf(this.moonStaking.address);
      await this.moonTokenV2.transferFrom(sender,receiver,ether("1"),{from:approvedSender})
      const {tax, burn, referral} = await this.moonTokenV2.taxAmount(ether("1"));
      const stakingFinalBalance = await this.moonTokenV2.balanceOf(this.moonStaking.address);
      expect(stakingFinalBalance.toString()).to.equal(stakingInitialBalance.add(tax).add(referral).toString())
    })
  })
})

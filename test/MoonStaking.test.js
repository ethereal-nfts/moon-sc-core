const { accounts, contract, web3 } = require("@openzeppelin/test-environment")
const { expectRevert, time, BN, ether, balance } = require("@openzeppelin/test-helpers")
const {expect} = require("chai")
const config = require("../config")

SECONDS_PER_DAY = 86400

const MoonTokenV2 = contract.fromArtifact("MoonTokenV2")
const MoonStaking = contract.fromArtifact("MoonStaking")
const MoonV2Swap = contract.fromArtifact("MoonV2Swap")
const Mock_MoonTokenV1 = contract.fromArtifact("Mock_MoonTokenV1")

const owner = accounts[0]
const stakers = [accounts[1],accounts[2],accounts[3],accounts[4]]
const nonStakerAccount = accounts[5]
const distributionAccount = accounts[6]
const referrers = [accounts[7],accounts[8]]

describe("MoonStaking", function() {
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
      tokenParams.bonusBP,
      owner,
      this.moonStaking.address
    )

    await this.moonStaking.initialize(
      stakingParams.startTime,
      stakingParams.taxBP,
      stakingParams.burnBP,
      stakingParams.refBP,
      stakingParams.referralPayoutBP,
      owner,
      stakingParams.referralPoolAdmins,
      this.moonTokenV2.address
    )

    await this.moonTokenV2.grantBonusWhitelistMulti(
      [stakers[0],stakers[1]],
      {from: owner}
    )

    const aidropReceivers = [nonStakerAccount, distributionAccount, ...stakers]

    await this.moonTokenV2.airdrop(
      aidropReceivers,
      aidropReceivers.map((elem)=>ether("250000")),
      {from: owner}
    )
  })

  describe("Stateles", function() {
    describe("#taxAmount", function(){
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
  })

  describe("State: Staking Inactive", function() {
    describe("#stake", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        await expectRevert(
          this.moonStaking.stake(ether("1"),{from:staker}),
          "Staking not yet started."
        )
      })
    })
    describe("#stakeWithReferrer", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        const referrer = referrers[0]
        await expectRevert(
          this.moonStaking.stakeWithReferrer(ether("1"),referrer,{from:staker}),
          "Staking not yet started."
        )
      })
    })
    describe("#unstake", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        await expectRevert(
          this.moonStaking.unstake(ether("1"),{from:staker}),
          "Staking not yet started."
        )
      })
    })
    describe("#withdraw", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        await expectRevert(
          this.moonStaking.withdraw(ether("1"),{from:staker}),
          "Staking not yet started."
        )
      })
    })
    describe("#reinvest", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        await expectRevert(
          this.moonStaking.reinvest(ether("1"),{from:staker}),
          "Staking not yet started."
        )
      })
    })
  })


  describe("State: Staking Active", function() {
    before(async function() {
      await time.advanceBlock()
      let latest = await time.latest()
      await time.increase(SECONDS_PER_DAY*30)
    })

    describe("#stake", function(){
      it("Should revert if less than 1 token", async function() {
        const staker = stakers[0]
        await expectRevert(
          this.moonStaking.stake(ether("1").sub(new BN(1)),{from:staker}),
          "Must stake at least 10000 MOON."
        )
        await expectRevert(
          this.moonStaking.stake(0,{from:staker}),
          "Must stake at least 10000 MOON."
        )
        await expectRevert(
          this.moonStaking.stake(new BN(1),{from:staker}),
          "Must stake at least 10000 MOON."
        )
      })
      it("Should increase totalStakers by 1", async function() {
        const staker = stakers[0]
        const initialTotalStakers = await this.moonStaking.totalStakers()
        await this.moonStaking.stake(ether("20000"),{from:staker})
        const finalTotalStakers = await this.moonStaking.totalStakers()
        expect(finalTotalStakers.toString())
          .to.equal(initialTotalStakers.add(new BN(1)).toString())
      })
      it("Should revert if staking more tokens than held", async function() {
        const staker = stakers[0]
        const balance = await this.moonTokenV2.balanceOf(staker)
        expect(balance.toString()).to.not.equal(new BN(0),{from:staker})
        await expectRevert(
          this.moonStaking.stake(balance.add(new BN(1)),{from:staker}),
          "Cannot stake more MOON than you hold unstaked."
        )
        await expectRevert(
          this.moonStaking.stake(balance.add(ether("10000000000000")),{from:staker}),
          "Cannot stake more MOON than you hold unstaked."
        )
      })
      it("Should decrease stakers balance by value", async function() {
        const staker = stakers[0]
        const value = ether("21000")
        const initialStakersTokens = await this.moonTokenV2.balanceOf(staker)
        await this.moonStaking.stake(value,{from:staker})
        const finalStakersTokens = await this.moonTokenV2.balanceOf(staker)
        expect(finalStakersTokens.toString())
          .to.equal(initialStakersTokens.sub(value).toString())
      })
      it("Should not change totalStakers", async function() {
        const staker = stakers[0]
        const initialTotalStakers = await this.moonStaking.totalStakers()
        await this.moonStaking.stake(ether("20000"),{from:staker})
        const finalTotalStakers = await this.moonStaking.totalStakers()
        expect(finalTotalStakers.toString())
          .to.equal(initialTotalStakers.toString())
      })
      it("Should increase totalStaked by value", async function() {
        const staker = stakers[0]
        const value = ether("21000")
        const initialTotalStaked = await this.moonStaking.totalStaked()
        await this.moonStaking.stake(value,{from:staker})
        const finalTotalStaked = await this.moonStaking.totalStaked()
        expect(finalTotalStaked.toString())
          .to.equal(initialTotalStaked.add(value).toString())
      })
      it("Should increase sender's staked amount by value", async function() {
        const staker = stakers[0]
        const value = ether("21000")
        const initialStakerBalance = await this.moonStaking.stakeValue(staker)
        await this.moonStaking.stake(value,{from:staker})
        const finalStakerBalance = await this.moonStaking.stakeValue(staker)
        expect(finalStakerBalance.toString())
          .to.equal(initialStakerBalance.add(value).toString())
      })
    })

    describe("#unstake", function(){
      it("Should revert if less than 1 token", async function() {
        const staker = stakers[0]
        await expectRevert(
          this.moonStaking.unstake(ether("1").sub(new BN(1)),{from:staker}),
          "Must unstake at least one MOON."
        )
        await expectRevert(
          this.moonStaking.unstake(0,{from:staker}),
          "Must unstake at least one MOON."
        )
        await expectRevert(
          this.moonStaking.unstake(new BN(1),{from:staker}),
          "Must unstake at least one MOON."
        )
      })
      it("Should revert if unstaking more tokens than staked", async function() {
        const staker = stakers[0]
        const balance = await this.moonStaking.stakeValue(staker)
        expect(balance.toString()).to.not.equal(new BN(0),{from:staker})
        await expectRevert(
          this.moonStaking.unstake(balance.add(new BN(1)),{from:staker}),
          "Cannot unstake more MOON than you have staked."
        )
        await expectRevert(
          this.moonStaking.unstake(balance.add(ether("10000000000000")),{from:staker}),
          "Cannot unstake more MOON than you have staked."
        )
      })
      it("Should decrease totalStaked balance by value", async function() {
        const staker = stakers[0]
        const value = ether("10000")
        const initialTotalStaked = await this.moonStaking.totalStaked()
        await this.moonStaking.unstake(value,{from:staker})
        const finalTotalStaked = await this.moonStaking.totalStaked()
        expect(finalTotalStaked.toString())
          .to.equal(initialTotalStaked.sub(value).toString())
      })
      it("Should increase stakers balance by value minus tax+burn+referral", async function() {
        const staker = stakers[0]
        const value = ether("10000")
        const {tax, burn, referral} = await this.moonStaking.taxAmount(value)
        const initialStakerBalance = await this.moonTokenV2.balanceOf(staker)
        await this.moonStaking.unstake(value,{from:staker})
        const finalStakerBalance = await this.moonTokenV2.balanceOf(staker)
        expect(finalStakerBalance.toString())
          .to.equal(initialStakerBalance.add(value).sub(tax).sub(burn).sub(referral).toString())
      })
      it("Should decrease sender's staked amount by value", async function() {
        const staker = stakers[0]
        const value = ether("10000")
        const initialStakerBalance = await this.moonStaking.stakeValue(staker)
        await this.moonStaking.unstake(value,{from:staker})
        const finalStakerBalance = await this.moonStaking.stakeValue(staker)
        const staker1DivisQ = await this.moonStaking.dividendsOf(stakers[0])
        expect(finalStakerBalance.toString())
          .to.equal(initialStakerBalance.sub(value).toString())
      })
      describe("Unstake All", function() {
        it("Should decrease totalStakers by 1 & Should increase stakers dividends by %owned * tax",async function() {
          const staker = stakers[0]
          const totalStaked = await this.moonStaking.totalStaked()
          const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
          const stakerValue = await this.moonStaking.stakeValue(staker)
          const initialTotalStakers = await this.moonStaking.totalStakers()
          const {tax, burn, referral} = await this.moonStaking.taxAmount(stakerValue)
          await this.moonStaking.unstake(stakerValue,{from:staker})
          const finalTotalStakers = await this.moonStaking.totalStakers()
          const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
          expect(finalTotalStakers.toString())
            .to.equal(initialTotalStakers.sub(new BN(1)).toString())
          expect(finalStakerDivis.sub(initialStakerDivis).toString())
            .to.equal(stakerValue.mul(tax).div(stakerValue).toString())
        })


      })
      it("Should increase other stakers dividends by tax/totalStaked * stakeValue", async function() {
        const staker = stakers[1]
        const unstaker = stakers[2]
        await this.moonStaking.stake(ether("10000"),{from:unstaker})
        const value = ether("10000")
        const {tax, burn, referral} = await this.moonStaking.taxAmount(value)
        const stakerShares = await this.moonStaking.stakeValue(staker)
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.unstake(ether("10000"),{from:unstaker})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        expect(tax.mul(stakerShares).div(totalStaked).toString())
          .to.equal(finalStakerDivis.sub(initialStakerDivis).toString())
      })
    })

    describe("#distribution", function(){
      before(async function() {
        await this.moonStaking.stake(ether("10000"),{from:stakers[0]})
        await this.moonStaking.stake(ether("15000"),{from:stakers[1]})
        await this.moonStaking.stake(ether("12000"),{from:stakers[2]})
        await this.moonStaking.stake(ether("91000"),{from:stakers[3]})
      })
      it("Should revert if distributing more than sender's balance", async function() {
        const balance = await this.moonTokenV2.balanceOf(distributionAccount)
        await expectRevert(
          this.moonStaking.distribute(balance.add(new BN(1)),{from: distributionAccount}),
          "Cannot distribute more MOON than you hold unstaked."
        )
      })
      it("Should increase totalDistributions by value", async function(){
        const value = ether("10000")
        const totalDistributionsInitial = await this.moonStaking.totalDistributions()
        await this.moonStaking.distribute(value,{from: distributionAccount})
        const totalDistributionsFinal = await this.moonStaking.totalDistributions()
        expect(totalDistributionsFinal.toString())
          .to.equal(totalDistributionsInitial.add(value).toString())
      })
      it("Should increase other stakers dividends by distribution/totalStaked * stakeValue", async function() {
        const staker = stakers[1]
        const value = ether("10000")
        const stakerShares = await this.moonStaking.stakeValue(staker)
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.distribute(value,{from:distributionAccount})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        expect(value.mul(stakerShares).div(totalStaked).toString())
          .to.equal(finalStakerDivis.sub(initialStakerDivis).toString())
      })
    })
    describe("#withdraw", function(){
      it("Should revert if withdrawing more than sender's dividends", async function() {
        const staker = stakers[0]
        const balance = await this.moonStaking.dividendsOf(staker)
        await expectRevert(
          this.moonStaking.withdraw(balance.add(new BN(1)),{from: staker}),
          "Cannot withdraw more dividends than you have earned."
        )
      })
      it("Should increase senders balance by value.", async function() {
        const value = ether("1000")
        const staker = stakers[0]
        const balanceInitial = await this.moonTokenV2.balanceOf(staker)
        this.moonStaking.withdraw(value,{from: staker})
        const balanceFinal = await this.moonTokenV2.balanceOf(staker)
        expect(balanceFinal.sub(balanceInitial).toString())
          .to.equal(value.toString())
      })
      it("Should decrease senders dividends by value.", async function() {
        const value = ether("1000")
        const staker = stakers[3]
        const divisInitial = await this.moonStaking.dividendsOf(staker)
        this.moonStaking.withdraw(value,{from: staker})
        const divisFinal = await this.moonStaking.dividendsOf(staker)
        expect(divisInitial.sub(divisFinal).toString())
          .to.equal(value.toString())
      })
    })

    describe("#reinvest", function(){
      it("Should revert if staking more tokens than in dividends", async function() {
        const staker = stakers[1]
        const divis = await this.moonStaking.dividendsOf(staker)
        expect(divis.toString()).to.not.equal(new BN(0),{from:staker})
        await expectRevert(
          this.moonStaking.reinvest(divis.add(new BN(1)),{from:staker}),
          "Cannot reinvest more dividends than you have earned."
        )
        await expectRevert(
          this.moonStaking.reinvest(divis.add(ether("1000000000")),{from:staker}),
          "Cannot reinvest more dividends than you have earned."
        )
      })
      it("Should decrease stakers dividends by value and add stakeValue.", async function() {
        const staker = stakers[1]
        const value = ether("1000")
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.reinvest(value,{from:staker})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        const stakerShares = await this.moonStaking.stakeValue(staker)
        expect(initialStakerDivis.sub(finalStakerDivis).toString())
          .to.equal(value.sub(stakerShares.div(totalStaked)).toString())
      })
      it("Should increase totalStaked by value", async function() {
        const staker = stakers[1]
        const value = ether("1000")
        const initialTotalStaked = await this.moonStaking.totalStaked()
        await this.moonStaking.reinvest(value,{from:staker})
        const finalTotalStaked = await this.moonStaking.totalStaked()
        expect(finalTotalStaked.toString())
          .to.equal(initialTotalStaked.add(value).toString())
      })
      it("Should increase sender's staked amount by value minus tax", async function() {
        const staker = stakers[1]
        const value = ether("100")
        const initialStakerBalance = await this.moonStaking.stakeValue(staker)
        await this.moonStaking.reinvest(value,{from:staker})
        const finalStakerBalance = await this.moonStaking.stakeValue(staker)
        expect(finalStakerBalance.toString())
          .to.equal(initialStakerBalance.add(value).toString())
      })
      it("Should not change other stakers dividends", async function() {
        const reinvester = stakers[1]
        const staker = stakers[2]
        const value = ether("50")
        const stakerShares = await this.moonStaking.stakeValue(staker)
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.reinvest(value,{from:reinvester})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        expect(stakerShares.div(totalStaked).toString())
          .to.equal(finalStakerDivis.sub(initialStakerDivis).toString())
      })
    })
  })
})

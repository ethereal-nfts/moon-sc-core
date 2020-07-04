const { accounts, contract, web3 } = require("@openzeppelin/test-environment")
const { expectRevert, time, BN, ether, balance } = require("@openzeppelin/test-helpers")
const {expect} = require("chai")
const config = require("../config")

const MoonToken = contract.fromArtifact("MoonToken")
const MoonStaking = contract.fromArtifact("MoonStaking")

const SECONDS_PER_DAY = 86400

const owner = accounts[0]
const stakers = [accounts[1],accounts[2],accounts[3],accounts[4]]
const nonStakerAccount = accounts[5]
const distributionAccount = accounts[6]

describe("MoonStaking", function() {
  before(async function() {
    const tokenParams = config.MoonToken
    const stakingParams = config.MoonStaking

    this.moonToken = await MoonToken.new()
    this.moonStaking = await MoonStaking.new()

    await this.moonToken.initialize(
      tokenParams.name,
      tokenParams.symbol,
      tokenParams.decimals,
      owner,
      tokenParams.taxBP,
      this.moonStaking.address
    )
    await this.moonStaking.initialize(
      stakingParams.stakingTaxBP,
      stakingParams.unstakingTaxBP,
      stakingParams.startTime,
      owner,
      this.moonToken.address
    )

    await Promise.all([
      this.moonToken.mint(stakers[0],ether('25'),{from: owner}),
      this.moonToken.mint(stakers[1],ether('25'),{from: owner}),
      this.moonToken.mint(stakers[2],ether('25'),{from: owner}),
      this.moonToken.mint(stakers[3],ether('25'),{from: owner}),
      this.moonToken.mint(nonStakerAccount,ether('25'),{from: owner}),
      this.moonToken.mint(distributionAccount,ether('25'),{from: owner}),
    ])
  })

  describe("Stateles", function() {
    describe("#findTaxAmount", function(){
      it("Should return taxBP/10000 of value passed.", async function() {
        const taxBP = config.MoonStaking.stakingTaxBP
        const tax = await this.moonStaking.findTaxAmount(ether("1"),new BN(taxBP))
        const expectedTax = ether("1").mul(new BN(taxBP)).div(new BN(10000))
        expect(tax.toString()).to.equal(expectedTax.toString())
      })
    })
  })

  describe("State: Staking Inactive", function() {
    describe("#stake", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        expectRevert(
          this.moonStaking.stake(ether("1"),{from:staker}),
          "Staking not yet started."
        )
      })
    })
    describe("#unstake", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        expectRevert(
          this.moonStaking.unstake(ether("1"),{from:staker}),
          "Staking not yet started."
        )
      })
    })
    describe("#withdraw", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        expectRevert(
          this.moonStaking.withdraw(ether("1"),{from:staker}),
          "Staking not yet started."
        )
      })
    })
    describe("#reinvest", function(){
      it("Should revert", async function() {
        const staker = stakers[0]
        expectRevert(
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
        expectRevert(
          this.moonStaking.stake(ether("1").sub(new BN(1)),{from:staker}),
          "Must stake at least one MOON."
        )
        expectRevert(
          this.moonStaking.stake(0,{from:staker}),
          "Must stake at least one MOON."
        )
        expectRevert(
          this.moonStaking.stake(new BN(1),{from:staker}),
          "Must stake at least one MOON."
        )
      })
      it("Should increase totalStakers by 1", async function() {
        const staker = stakers[0]
        const initialTotalStakers = await this.moonStaking.totalStakers()
        await this.moonStaking.stake(ether("2"),{from:staker})
        const finalTotalStakers = await this.moonStaking.totalStakers()
        expect(finalTotalStakers.toString())
          .to.equal(initialTotalStakers.add(new BN(1)).toString())
      })
      it("Should revert if staking more tokens than held", async function() {
        const staker = stakers[0]
        const balance = await this.moonToken.balanceOf(staker)
        expect(balance.toString()).to.not.equal(new BN(0),{from:staker})
        expectRevert(
          this.moonStaking.stake(balance.add(new BN(1)),{from:staker}),
          "Cannot stake more MOON than you hold unstaked."
        )
        expectRevert(
          this.moonStaking.stake(balance.add(ether("1000000000")),{from:staker}),
          "Cannot stake more MOON than you hold unstaked."
        )
      })
      it("Should decrease stakers balance by value", async function() {
        const staker = stakers[0]
        const value = ether("2.1")
        const initialStakersTokens = await this.moonToken.balanceOf(staker)
        await this.moonStaking.stake(value,{from:staker})
        const finalStakersTokens = await this.moonToken.balanceOf(staker)
        expect(finalStakersTokens.toString())
          .to.equal(initialStakersTokens.sub(value).toString())
      })
      it("Should not change totalStakers", async function() {
        const staker = stakers[0]
        const initialTotalStakers = await this.moonStaking.totalStakers()
        await this.moonStaking.stake(ether("2"),{from:staker})
        const finalTotalStakers = await this.moonStaking.totalStakers()
        expect(finalTotalStakers.toString())
          .to.equal(initialTotalStakers.toString())
      })
      it("Should increase totalStaked by value minus tax", async function() {
        const staker = stakers[0]
        const value = ether("2.1")
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        const initialTotalStaked = await this.moonStaking.totalStaked()
        await this.moonStaking.stake(value,{from:staker})
        const finalTotalStaked = await this.moonStaking.totalStaked()
        expect(finalTotalStaked.toString())
          .to.equal(initialTotalStaked.add(value).sub(tax).toString())
      })
      it("Should increase sender's staked amount by value minus tax", async function() {
        const staker = stakers[0]
        const value = ether("2.1")
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        const initialStakerBalance = await this.moonStaking.stakeValue(staker)
        await this.moonStaking.stake(value,{from:staker})
        const finalStakerBalance = await this.moonStaking.stakeValue(staker)
        expect(finalStakerBalance.toString())
          .to.equal(initialStakerBalance.add(value).sub(tax).toString())
      })
      it("For single staker, dividends+stakeValue[staker] should be contract balance.", async function() {
        const staker = stakers[0]
        const balance = await this.moonToken.balanceOf(this.moonStaking.address)
        const stake = await this.moonStaking.stakeValue(staker)
        const divis = await this.moonStaking.dividendsOf(staker)
        expect(stake.add(divis).toString())
          .to.equal(balance.sub(new BN(1)).toString())
      })
      it("When second staker doubles total staked, first stakers dividends should increase by half of tax.", async function() {
        const stakerFirst = stakers[0]
        const stakerSecond = stakers[1]
        const totalStaked = await this.moonStaking.totalStaked()
        const initialDivis = await this.moonStaking.dividendsOf(stakerFirst)
        const value = totalStaked.mul(new BN(10000)).div((new BN(10000)).sub(new BN(config.MoonStaking.stakingTaxBP)))
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        await this.moonStaking.stake(value,{from:stakerSecond})
        const finalDivis = await this.moonStaking.dividendsOf(stakerFirst)
        const stakerSecondDivis = await this.moonStaking.dividendsOf(stakerSecond)
        expect(finalDivis.sub(initialDivis).toString())
          .to.equal(tax.div(new BN(2)).toString())
        expect(stakerSecondDivis.toString())
          .to.equal(tax.div(new BN(2)).sub(new BN(1)).toString())
      })
      it("When third staker increases total staked by 50%, others stakers dividends should increase by third of tax.", async function() {
        const staker1 = stakers[0]
        const staker2 = stakers[1]
        const staker3 = stakers[2]
        const totalStaked = await this.moonStaking.totalStaked()
        const initialDivisStaker1 = await this.moonStaking.dividendsOf(staker1)
        const initialDivisStaker2 = await this.moonStaking.dividendsOf(staker2)
        const value = totalStaked.div(new BN(2)).mul(new BN(10000)).div((new BN(10000)).sub(new BN(config.MoonStaking.stakingTaxBP)))
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        await this.moonStaking.stake(value,{from:staker3})
        const finalDivisStaker1 = await this.moonStaking.dividendsOf(staker1)
        const finalDivisStaker2 = await this.moonStaking.dividendsOf(staker2)
        const finalDivisStaker3 = await this.moonStaking.dividendsOf(staker3)
        expect(finalDivisStaker1.sub(initialDivisStaker1).toString())
          .to.equal(tax.div(new BN(3)).toString())
        expect(finalDivisStaker2.sub(initialDivisStaker2).toString())
          .to.equal(tax.div(new BN(3)).toString())
        expect(finalDivisStaker3.toString())
          .to.equal(tax.div(new BN(3)).sub(new BN(1)).toString())
      })
    })

    describe("#unstake", function(){
      it("Should revert if less than 1 token", async function() {
        const staker = stakers[0]
        expectRevert(
          this.moonStaking.unstake(ether("1").sub(new BN(1)),{from:staker}),
          "Must unstake at least one MOON."
        )
        expectRevert(
          this.moonStaking.unstake(0,{from:staker}),
          "Must unstake at least one MOON."
        )
        expectRevert(
          this.moonStaking.unstake(new BN(1),{from:staker}),
          "Must unstake at least one MOON."
        )
      })
      it("Should revert if unstaking more tokens than staked", async function() {
        const staker = stakers[0]
        const balance = await this.moonStaking.stakeValue(staker)
        expect(balance.toString()).to.not.equal(new BN(0),{from:staker})
        expectRevert(
          this.moonStaking.unstake(balance.add(new BN(1)),{from:staker}),
          "Cannot unstake more MOON than you have staked."
        )
        expectRevert(
          this.moonStaking.unstake(balance.add(ether("1000000000")),{from:staker}),
          "Cannot unstake more MOON than you have staked."
        )
      })
      it("Should decrease totalStaked balance by value", async function() {
        const staker = stakers[0]
        const value = ether("1")
        const initialTotalStaked = await this.moonStaking.totalStaked()
        await this.moonStaking.unstake(value,{from:staker})
        const finalTotalStaked = await this.moonStaking.totalStaked()
        expect(finalTotalStaked.toString())
          .to.equal(initialTotalStaked.sub(value).toString())
      })
      it("Should increase stakers balance by value minus tax", async function() {
        const staker = stakers[0]
        const value = ether("1")
        const tax = await this.moonStaking.findTaxAmount(value,new BN(config.MoonStaking.unstakingTaxBP))
        const initialStakerBalance = await this.moonToken.balanceOf(staker)
        await this.moonStaking.unstake(value,{from:staker})
        const finalStakerBalance = await this.moonToken.balanceOf(staker)
        expect(finalStakerBalance.toString())
          .to.equal(initialStakerBalance.add(value).sub(tax).toString())
      })
      it("Should decrease sender's staked amount by value", async function() {
        const staker = stakers[0]
        const value = ether("1")
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
          const tax = await this.moonStaking.findTaxAmount(stakerValue,new BN(config.MoonStaking.unstakingTaxBP))
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
        const value = ether("1")
        const tax = await this.moonStaking.findTaxAmount(value,new BN(config.MoonStaking.unstakingTaxBP))
        const stakerShares = await this.moonStaking.stakeValue(staker)
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.unstake(ether("1"),{from:unstaker})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        expect(tax.mul(stakerShares).div(totalStaked).toString())
          .to.equal(finalStakerDivis.sub(initialStakerDivis).toString())
      })
    })

    describe("#distribution", function(){
      before(async function() {
        await this.moonStaking.stake(ether("1"),{from:stakers[0]})
        await this.moonStaking.stake(ether("1.5"),{from:stakers[1]})
        await this.moonStaking.stake(ether("1.2"),{from:stakers[2]})
        await this.moonStaking.stake(ether("9.1"),{from:stakers[3]})
      })
      it("Should revert if distributing more than sender's balance", async function() {
        const balance = await this.moonToken.balanceOf(distributionAccount)
        expectRevert(
          this.moonStaking.distribute(balance.add(new BN(1)),{from: distributionAccount}),
          "Cannot distribute more MOON than you hold unstaked."
        )
      })
      it("Should increase totalDistributions by value", async function(){
        const value = ether("1")
        const totalDistributionsInitial = await this.moonStaking.totalDistributions()
        await this.moonStaking.distribute(value,{from: distributionAccount})
        const totalDistributionsFinal = await this.moonStaking.totalDistributions()
        expect(totalDistributionsFinal.toString())
          .to.equal(totalDistributionsInitial.add(value).toString())
      })
      it("Should increase other stakers dividends by distribution/totalStaked * stakeValue", async function() {
        const staker = stakers[1]
        const value = ether("1")
        const stakerShares = await this.moonStaking.stakeValue(staker)
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.distribute(value,{from:distributionAccount})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        expect(value.mul(stakerShares).div(totalStaked).toString())
          .to.equal(finalStakerDivis.sub(initialStakerDivis).sub(new BN(1)).toString())
      })
    })
    describe("#withdraw", function(){
      it("Should revert if withdrawing more than sender's dividends", async function() {
        const staker = stakers[0]
        const balance = await this.moonStaking.dividendsOf(staker)
        expectRevert(
          this.moonStaking.withdraw(balance.add(new BN(1)),{from: staker}),
          "Cannot withdraw more dividends than you have earned."
        )
      })
      it("Should increase senders balance by value.", async function() {
        const value = ether("0.1")
        const staker = stakers[0]
        const balanceInitial = await this.moonToken.balanceOf(staker)
        this.moonStaking.withdraw(value,{from: staker})
        const balanceFinal = await this.moonToken.balanceOf(staker)
        expect(balanceFinal.sub(balanceInitial).toString())
          .to.equal(value.toString())
      })
      it("Should decrease senders dividends by value.", async function() {
        const value = ether("0.1")
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
        expectRevert(
          this.moonStaking.reinvest(divis.add(new BN(1)),{from:staker}),
          "Cannot reinvest more dividends than you have earned."
        )
        expectRevert(
          this.moonStaking.reinvest(divis.add(ether("1000000000")),{from:staker}),
          "Cannot reinvest more dividends than you have earned."
        )
      })
      it("Should decrease stakers dividends by value but add tax/totalStaked * stakeValue.", async function() {
        const staker = stakers[1]
        const value = ether("0.1")
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.reinvest(value,{from:staker})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        const stakerShares = await this.moonStaking.stakeValue(staker)
        expect(initialStakerDivis.sub(finalStakerDivis).toString())
          .to.equal(value.sub(tax.mul(stakerShares).div(totalStaked)).toString())
      })
      it("Should increase totalStaked by value minus tax", async function() {
        const staker = stakers[1]
        const value = ether("0.1")
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        const initialTotalStaked = await this.moonStaking.totalStaked()
        await this.moonStaking.reinvest(value,{from:staker})
        const finalTotalStaked = await this.moonStaking.totalStaked()
        expect(finalTotalStaked.toString())
          .to.equal(initialTotalStaked.add(value).sub(tax).toString())
      })
      it("Should increase sender's staked amount by value minus tax", async function() {
        const staker = stakers[1]
        const value = ether("0.01")
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        const initialStakerBalance = await this.moonStaking.stakeValue(staker)
        await this.moonStaking.reinvest(value,{from:staker})
        const finalStakerBalance = await this.moonStaking.stakeValue(staker)
        expect(finalStakerBalance.toString())
          .to.equal(initialStakerBalance.add(value).sub(tax).toString())
      })
      it("Should increase other stakers dividends by tax/totalStaked * stakeValue", async function() {
        const reinvester = stakers[1]
        const staker = stakers[2]
        const value = ether("0.1")
        const tax = await this.moonStaking.findTaxAmount(value,config.MoonStaking.stakingTaxBP)
        const stakerShares = await this.moonStaking.stakeValue(staker)
        const initialStakerDivis = await this.moonStaking.dividendsOf(staker)
        await this.moonStaking.reinvest(value,{from:reinvester})
        const finalStakerDivis = await this.moonStaking.dividendsOf(staker)
        const totalStaked = await this.moonStaking.totalStaked()
        expect(tax.mul(stakerShares).div(totalStaked).toString())
          .to.equal(finalStakerDivis.sub(initialStakerDivis).toString())
      })
    })
  })
})

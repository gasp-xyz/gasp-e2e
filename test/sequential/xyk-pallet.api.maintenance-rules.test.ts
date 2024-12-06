/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group maintenance
 */
import { jest } from '@jest/globals'
import { getApi, initApi } from '../../utils/api'
import { ExtrinsicResult, expectMGAExtrinsicSuDidSuccess } from '../../utils/eventListeners'
import { BN, BN_TWO } from '@polkadot/util'
import {
  setupApi,
  setup5PoolsChained,
  Extrinsic,
  setupUsers,
  setupAsEthTokens,
} from '../../utils/setup'
import { getEventResultFromMangataTx } from '../../utils/txHandler'
import { FOUNDATION_ADDRESS_1, GASP_ASSET_ID } from '../../utils/Constants'
import { BN_MILLION, BN_TEN, BN_TEN_THOUSAND } from 'gasp-sdk'
import { BN_ONE, BN_HUNDRED, signTx } from 'gasp-sdk'
import { Sudo } from '../../utils/sudo'
import { Xyk } from '../../utils/xyk'
import { ApiPromise, Keyring } from '@polkadot/api'
import { Assets } from '../../utils/Assets'
import { AggregatorOptions, Staking, tokenOriginEnum } from '../../utils/Staking'
import { Maintenance } from '../../utils/Maintenance'
import { getLiquidityAssetId } from '../../utils/tx'
import { ProofOfStake } from '../../utils/ProofOfStake'
import { User } from '../../utils/User'
import { getPoolIdsInfo, Market } from '../../utils/market'
import { getL1 } from '../../utils/rollup/l1s'
import { setupEthUser } from '../../utils/rollup/ethUtils'
import { L2Update, Rolldown } from '../../utils/rollDown/Rolldown'
import { Ferry } from '../../utils/rollDown/Ferry'
import { expectExtrinsicFail } from '../../utils/utils'
import { Withdraw } from '../../utils/rolldown'
import { SudoDB } from '../../utils/SudoDB'

jest.spyOn(console, 'log').mockImplementation(jest.fn())
jest.setTimeout(1500000)

let users: User[] = []
let tokenIds: BN[] = []
let api: ApiPromise
let swapOperations: { [K: string]: Extrinsic } = {}
let testUser1: User
let testUser2: User
let minStk: BN
let user: User
let ferrier: User
let txIndex: number
let gaspL1Address: string
let chain: any
let recipient: User

const foundationAccountAddress = FOUNDATION_ADDRESS_1
//TODO: Goncer Need to change getTokenIds function in setup5PoolsChained
describe('On Maintenance mode - multiSwaps / swaps / compound / prov liq are not allowed', () => {
  beforeAll(async () => {
    try {
      getApi()
    } catch (e) {
      await initApi()
    }
    await setupApi()
    ;({ users, tokenIds } = await setup5PoolsChained(users))
    api = await getApi()
    const liq = await getLiquidityAssetId(tokenIds.slice(-1)[0], GASP_ASSET_ID)
    const { swapPoolList: poolIds, firstToken, lastToken } = await getPoolIdsInfo(tokenIds)
    swapOperations = {
      multiswapSellAsset: Market.multiswapAssetSell(
        poolIds,
        firstToken,
        BN_HUNDRED,
        lastToken,
        BN_ONE
      ),
      multiswapBuyAsset: Market.multiswapAssetBuy(
        poolIds,
        firstToken,
        BN_HUNDRED,
        lastToken,
        BN_MILLION
      ),
      sellAsset: Xyk.sellAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_ONE),
      buyAsset: Xyk.buyAsset(tokenIds[0], tokenIds[1], BN_HUNDRED, BN_MILLION),
      provideLiquidity: Xyk.provideLiquidity(liq, GASP_ASSET_ID, BN_HUNDRED),
    }
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOff())
    )
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOn()),
      ProofOfStake.updatePoolPromotion(liq, 20)
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value)
    })
  })
  let userIndex = 0
  it.each(['multiswapSellAsset', 'multiswapBuyAsset', 'sellAsset', 'buyAsset'])(
    '%s operation is not allowed in mm',
    async (operation) => {
      const extrinsic = swapOperations[operation]
      userIndex += 1
      await signTx(api, extrinsic, users[userIndex % users.length].keyRingPair)
        .then((events) => {
          const event = getEventResultFromMangataTx(events, ['system', 'ExtrinsicFailed'])
          expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed)
          expect(event.data).toContain('TradingBlockedByMaintenanceMode')
        })
        .catch((exc) => {
          expect(JSON.parse(JSON.stringify(exc)).data.toString()).toContain(
            '1010: Invalid Transaction: The swap prevalidation has failed'
          )
        })
    }
  )
  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOff())
    )
  })
})
describe('On Maintenance mode - aggregators and candidates are allowed', () => {
  beforeAll(async () => {
    try {
      getApi()
    } catch (e) {
      await initApi()
    }
    await setupApi()
    ;[testUser1, testUser2] = setupUsers()
    await setupApi()
    minStk = new BN((await getApi()).consts.parachainStaking.minCandidateStk.toString())
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser1, minStk.muln(1000)),
      Assets.mintNative(testUser2, minStk.muln(1000)),
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOn())
    )
  })
  it('Join as candidate , Aggregate metadata and update CandidateAgg runs on Mm', async () => {
    const aggregator = testUser1
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser2,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          GASP_ASSET_ID,
          tokenOriginEnum.AvailableBalance
        )
      ),
      Sudo.sudoAs(
        aggregator,
        Staking.aggregatorUpdateMetadata([testUser2], AggregatorOptions.ExtendApprovedCollators)
      ),
      Sudo.sudoAs(testUser2, Staking.updateCandidateAggregator(aggregator))
    ).then((events) => {
      expectMGAExtrinsicSuDidSuccess(events)
    })
    const candidateAggData = await Staking.candidateAggregator()
    expect(candidateAggData[testUser2.keyRingPair.address.toLowerCase()]).toEqual(
      aggregator.keyRingPair.address.toLowerCase()
    )
  })

  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOff())
    )
  })
})
describe.skip('On Maintenance mode - ferry deposits are not allowed', () => {
  beforeAll(async () => {
    try {
      getApi()
    } catch (e) {
      await initApi()
    }
    await setupApi()
    ;[user] = setupUsers()

    const keyRing = new Keyring({ type: 'ethereum' })
    user = new User(keyRing)
    const params = getL1('EthAnvil')
    await setupEthUser(
      user,
      params?.contracts.dummyErc20.address!,
      params?.contracts.rollDown.address!,
      112233445566
    )
    await Sudo.batchAsSudoFinalized(Assets.mintNative(user))
    gaspL1Address = await Assets.getAssetAddress(GASP_ASSET_ID)
    ferrier = await Ferry.setupFerrier('EthAnvil')
    txIndex = await Rolldown.lastProcessedRequestOnL2(chain)
    ;[recipient] = setupUsers()
    recipient.addAsset(GASP_ASSET_ID)
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOff())
    )
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOn())
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value)
    })
  })
  it('A user cannot do ferry deposit - extrinsic failed', async () => {
    const ferryTip = BN_TEN
    const update1 = new L2Update(api)
      .withDeposit(
        txIndex,
        recipient.keyRingPair.address,
        gaspL1Address,
        BN_TEN_THOUSAND,
        0,
        ferryTip
      )
      .on(chain)

    const events = await Ferry.ferryThisDeposit(ferrier, update1.pendingDeposits[0], 'EthAnvil')
    expectExtrinsicFail(events)
  })

  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOff())
    )
  })
})

describe('On maintanance mode - withdraw extrinsic should fail', () => {
  beforeEach(async () => {
    try {
      getApi()
    } catch (e) {
      await initApi()
    }
    await setupApi()
    ;[user] = setupUsers()

    await Sudo.batchAsSudoFinalized(Assets.mintNative(user))
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOff())
    )
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOn())
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value)
    })
  })

  it('withdrawing token which does not exist should return correct error', async () => {
    const tokenIds = await SudoDB.getInstance().getTokenIds(1)
    const [token] = await setupAsEthTokens(tokenIds)
    const tokenAddress = JSON.parse(token.toString()).ethereum
    const errorMsg = 'BlockedByMaintenanceMode'

    const api = getApi()

    const withdrawTx = await Withdraw(user, BN_TWO, tokenAddress, 'Ethereum')

    const events = await signTx(api, withdrawTx, user.keyRingPair)
    const response = expectExtrinsicFail(events)
    expect(response.data).toEqual(errorMsg)
  })

  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(foundationAccountAddress, Maintenance.switchMaintenanceModeOff())
    )
  })
})

import { jest } from "@jest/globals";
import { signTx } from "@mangata-finance/sdk";
import { Keyring } from "@polkadot/api";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN_TEN } from "@mangata-finance/sdk";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { MangataInstance } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { getLiquidityAssetId } from "../../utils/tx";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { testLog } from "./../../utils/Logger";
// import { waitForRewards } from "../../utils/eventListeners";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser: User;
let testUser1: User;
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let rewardToken: BN;
let rewardedPool: BN;
let mangata: MangataInstance;
const defaultCurrencyValue = new BN(250000);

async function waitForSession(session_nr: number) {
  let api = getApi();


  return new Promise(async (resolve, _reject) => {
    const unsub_new_heads = await getApi().rpc.chain.subscribeNewHeads(async (header) => {
      let current_session = (await api.query.session.currentIndex()).toNumber();


      if (current_session >= session_nr) {
        unsub_new_heads()
        resolve(current_session);
      } else {
        testLog.getLog().info(`#${header.number} session: ${current_session} < ${session_nr}`);
      }
    }
    );
  });
}


beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  const { chainUri } = getEnvironmentRequiredVars();
  mangata = await getMangataInstance(chainUri);
  await mangata.api();

  // setup users
  sudo = new User(keyring, sudoUserName);

  [testUser, testUser1, testUser2] = setupUsers();

  await setupApi();

  [token1, rewardToken] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );

  const DEFAULT_AMOUNT: BN = BN_TEN.pow(new BN(30));

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser, DEFAULT_AMOUNT),
    Assets.mintToken(rewardToken, testUser, DEFAULT_AMOUNT),
    Assets.mintNative(testUser, DEFAULT_AMOUNT.muln(2)),
    Assets.mintToken(token1, testUser1, DEFAULT_AMOUNT),
    Assets.mintToken(rewardToken, testUser1, DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    // Assets.mintToken(token1, testUser2, DEFAULT_AMOUNT),
    // Assets.mintToken(rewardToken, testUser2, DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        DEFAULT_AMOUNT.divn(2),
        token1,
        DEFAULT_AMOUNT.divn(2),
      ),
    ),
    Sudo.sudoAs(
      testUser,
      Xyk.createPool(
        MGA_ASSET_ID,
        DEFAULT_AMOUNT.divn(2),
        rewardToken,
        DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  rewardedPool = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(rewardedPool, testUser2, DEFAULT_AMOUNT)
  );

  testUser1.addAsset(rewardedPool);
  testUser1.addAsset(token1);

  testUser2.addAsset(rewardedPool);
  testUser2.addAsset(rewardToken);
});

test("Demo 3rdparty rewards", async () => {
  testLog.getLog().info(`Liquidity token : ${rewardedPool} => (${MGA_ASSET_ID}, ${token1})`);
  testLog.getLog().info(`Reward token    : ${rewardToken}`);
  testLog.getLog().info(`User            : ${testUser2.keyRingPair.address} `);

  // testLog.getLog().info(`RPC payload     :       ${testUser2.keyRingPair.address} `);


  let api = getApi();
  let current_session = (await api.query.session.currentIndex()).toNumber();

  // current limit is ~100 USD
  const MIN_REWARDS_AMOUNT: BN = BN_TEN.pow(new BN(18)).muln(30000).muln(100);
  await signTx(
    api,
    api.tx.proofOfStake.rewardPool(
      [MGA_ASSET_ID, token1],
      rewardToken,
      MIN_REWARDS_AMOUNT.muln(1000),
      current_session + 100,
    ),
    testUser1.keyRingPair,
  );


  await signTx(
    api,
    api.tx.proofOfStake.activateLiquidityFor3rdpartyRewards(
      rewardedPool,
      new BN(100),
      rewardToken,
      null,
    ),
    testUser2.keyRingPair,
  );

  current_session = (await api.query.session.currentIndex()).toNumber();
  await waitForSession(current_session + 2);

  await signTx(
    api,
    api.tx.proofOfStake.claim3rdpartyRewards(
      rewardedPool,
      rewardToken,
    ),
    testUser2.keyRingPair
  );

  // await promotePool(token1);
  //
  // await Sudo.batchAsSudoFinalized(
  //   Sudo.sudoAs(
  //     testUser1,
  //     Xyk.mintLiquidity(
  //       MGA_ASSET_ID,
  //       token1,
  //       defaultCurrencyValue.mul(new BN(2)),
  //     ),
  //   ),
  //   Sudo.sudoAs(
  //     testUser2,
  //     Xyk.mintLiquidity(MGA_ASSET_ID, token1, defaultCurrencyValue),
  //   ),
  // );
  //
  // await waitForRewards(testUser1, rewardedPool);
  //
  // const rewardsAmountUser1 = await mangata.rpc.calculateRewardsAmount({
  //   address: testUser1.keyRingPair.address,
  //   liquidityTokenId: rewardedPool.toString(),
  // });
  //
  // const rewardsAmountUser2 = await mangata.rpc.calculateRewardsAmount({
  //   address: testUser2.keyRingPair.address,
  //   liquidityTokenId: rewardedPool.toString(),
  // });
  // const rewardsDifference = rewardsAmountUser1.sub(
  //   rewardsAmountUser2.mul(new BN(2)),
  // );
  //
  // expect(rewardsAmountUser1.div(rewardsDifference)).bnGt(new BN(10000));
  return Promise.resolve();
});


// async function promotePool(token: BN) {
//   rewardedPool = await getLiquidityAssetId(MGA_ASSET_ID, token);
//
//   await Sudo.batchAsSudoFinalized(
//     Assets.promotePool(rewardedPool.toNumber(), 20),
//   );
// }

import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import {
  alice,
  api,
  Extrinsic,
  setupApi,
  setupUsers,
  sudo,
} from "../../utils/setup";
import { testLog } from "../../utils/Logger";
import { ApiPromise, WsProvider } from "@polkadot/api";
import {
  awaitEvent,
  signSendFinalized,
  signSendSuccess,
} from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { BN_MILLION, BN_ONE, BN_THOUSAND, BN_ZERO } from "@mangata-finance/sdk";
import { getNextAssetId } from "../../utils/tx";
import { BN } from "@polkadot/util";

// const HOUR = 60 * 60;
const weightInSeconds = new BN(1_000_000_000_000);

/**
 * @group oak-network
 *
 * https://docs.google.com/document/d/1LSQyZKu5G_xHB-FXyDrYCqfmnq-R2euJw_jHpeHn4us/edit#heading=h.cr78w1wk9jwg
 */
describe("auto-compound story: provide_liquidity_with_conversion XCM task", () => {
  let user1: User;
  let oakApi: OakApi;

  beforeAll(async () => {
    await setupApi();
    [user1] = setupUsers();

    const { oakUri } = getEnvironmentRequiredVars();
    oakApi = await OakApi.create(oakUri!);
  });

  it("auto-compound: register assets", async () => {
    testLog.getLog().info("running section: register token on OAK");
    await signSendSuccess(
      oakApi.api,
      oakApi.api.tx.sudo.sudo(
        oakApi.api.tx.assetRegistry.registerAsset(
          {
            decimals: 10,
            name: oakApi.api.createType("Vec<u8>", "Native"),
            symbol: oakApi.api.createType("Vec<u8>", "TUR"),
            existentialDeposit: 0,
            location: { V1: { parents: 0, interior: "Here" } },
            additional: { feePerSecond: 419000000000 },
          },
          // @ts-ignore
          undefined
        )
      ),
      alice
    );

    testLog.getLog().info("running section: register token on MG");

    await signSendFinalized(
      Assets.registerAsset(
        "Turing",
        "TUR",
        10,
        {
          parents: 1,
          interior: { X1: { Parachain: 2114 } },
        },
        537600000000
      ),
      sudo
    );

    testLog.getLog().info("running section: setup currency");

    await signSendSuccess(
      oakApi.api,
      oakApi.api.tx.sudo.sudo(oakApi.addChainCurrencyData(2110, 1)),
      alice
    );

    // send some TURs to our chain, so we can mint & send them back, otherwise XCM would fail
    await signSendSuccess(
      oakApi.api,
      oakApi.api.tx.xTokens.transfer(
        1,
        1_000_000_000_000_000,
        {
          V1: {
            parents: 1,
            interior: {
              X2: [
                { Parachain: 2110 },
                {
                  AccountId32: {
                    network: "Any",
                    id: alice.keyRingPair.publicKey,
                  },
                },
              ],
            },
          },
        },
        4_000_000_000
      ),
      alice
    );
  });

  it("auto-compound: task id", async () => {
    // @ts-ignore
    const taskId = await oakApi.api.rpc.automationTime.generateTaskId(
      alice.keyRingPair.address,
      "compound"
    );
    testLog.getLog().info(`task id: ${taskId}`);
  });

  it("auto-compound: schedule & execute task", async () => {
    testLog.getLog().info("running section: prepare compound extrinsic");

    // @ts-ignore
    const proxy = await oakApi.api.rpc.xcmpHandler.crossChainAccount(
      user1.keyRingPair.address
    );
    const assetId = await getNextAssetId();
    const poolId = assetId.add(BN_ONE);
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(user1),
      Assets.issueToken(user1),
      Sudo.sudoAs(user1, api.tx.proxy.addProxy(proxy, { AutoCompound: 0 }, 0)),
      Sudo.sudoAs(
        user1,
        Xyk.createPool(BN_ZERO, BN_MILLION, assetId, BN_MILLION)
      )
    );

    // it is complex to set up the chain with predefined rewards, it is enough to test without it
    // we provide 1_000 MGR into the poolId
    const tx = api.tx.proxy.proxy(
      user1.keyRingPair.address,
      undefined,
      api.tx.xyk.provideLiquidityWithConversion(poolId, 0, BN_THOUSAND)
    );
    const encodedTxHex = tx.unwrap().toHex();
    const encodedTxInfo = await tx.paymentInfo(user1.keyRingPair);

    testLog.getLog().info(encodedTxHex);
    testLog.getLog().info("running section: schedule task: " + encodedTxHex);
    const taskId = "compound";
    // const seconds = Math.trunc(new Date().getTime() / 1000);
    // const nextHour = seconds - (seconds % HOUR) + HOUR;

    const executions = [0];
    const txCreate = oakApi.api.tx.automationTime.scheduleXcmpTask(
      // task id
      oakApi.api.createType("Vec<u8>", taskId),
      // intervals for task execution, 0 == immediate execution, only with 'features=dev_queue' oak build
      executions,
      // destination para id
      2110,
      // currency id - the registered TUR in this case
      1,
      // encoded call
      oakApi.api.createType("Vec<u8>", encodedTxHex),
      // extrinsic weight
      encodedTxInfo.weight
    );

    const info = await txCreate.paymentInfo(user1.keyRingPair);
    const currencyData =
      await oakApi.api.query.xcmpHandler.xcmChainCurrencyData(2110, 1);
    const totalWeight = new BN(encodedTxInfo.weight).add(
      // @ts-ignore
      new BN(currencyData.unwrap().instructionWeight)
    );
    const taskExecutionFee = totalWeight
      // @ts-ignore
      .mul(new BN(currencyData.unwrap().feePerSecond))
      .div(weightInSeconds);

    // const xcmExecutionFee = new BN(4_000_000_000) // TUR base unit cost weight * 4 instructions in transfer
    //   .mul(new BN(419000000000)) // TUR fps
    //   .div(weightInSeconds);

    const automationTimeFee =
      // @ts-ignore
      await oakApi.api.rpc.automationTime.getTimeAutomationFees("XCMP", 1);

    const totalFees = new BN(info.partialFee)
      .add(taskExecutionFee.mul(new BN(executions.length)))
      .add(new BN(automationTimeFee))
      .add(new BN(10_0000000000));
    // .add(xcmExecutionFee);

    testLog.getLog().info("running section: fees to TUR network: " + totalFees);

    // do the TUR swap, we just simulate by minting
    // and send them over to TUR chain
    /*
    const turAssetId = new BN(7);
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(turAssetId, user1, totalFees),
      Sudo.sudoAs(
        user1,
        api.tx.xTokens.transfer(
          turAssetId,
          totalFees,
          {
            V1: {
              parents: 1,
              interior: {
                X2: [
                  { Parachain: 2114 },
                  {
                    AccountId32: {
                      network: "Any",
                      id: user1.keyRingPair.publicKey,
                    },
                  },
                ],
              },
            },
          },
          4_000_000_000
        )
      )
    );
*/

    // use direct transfer instead, xcm is broken in this setup
    await signSendSuccess(
      oakApi.api,
      oakApi.api.tx.balances.transfer(user1.keyRingPair.address, totalFees),
      alice
    );

    await signSendSuccess(oakApi.api, txCreate, user1);

    testLog.getLog().info("running section: await execute task");
    // check the xcm automation success on oak
    await awaitEvent(oakApi.api, "automationTime.XcmpTaskSucceeded");
    // check that we have minted some liquidity
    await awaitEvent(api, "xyk.LiquidityMinted");
  });
});

/**
 * @group oak-network
 */
describe("auto-compound story: check all fees", () => {
  let user1: User;
  let oakApi: OakApi;

  beforeAll(async () => {
    await setupApi();
    [user1] = setupUsers();
    user1 = alice;

    const { oakUri } = getEnvironmentRequiredVars();
    oakApi = await OakApi.create(oakUri!);
  });

  it("auto-compound: proxy fee", async () => {
    let feeInfo = await api.tx.proxy
      .addProxy(user1.keyRingPair.address, { AutoCompound: 0 }, 0)
      .paymentInfo(user1.keyRingPair);

    testLog.getLog().info(`auto-compound: proxy fee = ${feeInfo.partialFee}`);

    const tx = api.tx.proxy.proxy(
      user1.keyRingPair.address,
      undefined,
      api.tx.xyk.provideLiquidityWithConversion(1, 0, BN_THOUSAND)
    );
    const encodedCall = tx.unwrap().toHex();
    const weight = await tx
      .paymentInfo(user1.keyRingPair)
      .then((value) => value.weight);

    feeInfo = await oakApi.api.tx.automationTime
      .scheduleXcmpTask(
        // task id
        oakApi.api.createType("Vec<u8>", "compound"),
        // intervals for task execution, 0 == immediate execution, only with 'features=dev_queue' oak build
        [0],
        // destination para id
        2110,
        // currency id - the registered TUR in this case
        1,
        // encoded call
        oakApi.api.createType("Vec<u8>", encodedCall),
        // extrinsic weight
        weight
      )
      .paymentInfo(alice.keyRingPair);
    testLog
      .getLog()
      .info(
        `auto-compound: automation task create fee = ${feeInfo.partialFee}`
      );

    const currencyData =
      await oakApi.api.query.xcmpHandler.xcmChainCurrencyData(2110, 1);
    // @ts-ignore
    const totalWeight = weight + currencyData.unwrap().instructionWeight;
    const fee =
      // @ts-ignore
      (totalWeight * currencyData.unwrap().feePerSecond) / 1_000_000_000_000;

    testLog
      .getLog()
      .info(`auto-compound: automation task execution fee = ${fee}`);

    const automationTimeFee =
      // @ts-ignore
      await oakApi.api.rpc.automationTime.getTimeAutomationFees("XCMP", 1);
    testLog
      .getLog()
      .info(`auto-compound: automationTime fee = ${automationTimeFee}`);

    // xcm transact fee in TUR on MG
  });
});

class OakApi {
  api: ApiPromise;

  addChainCurrencyData(paraId: number, currencyId: number): Extrinsic {
    return this.api.tx.xcmpHandler.addChainCurrencyData(paraId, currencyId, {
      native: false,
      feePerSecond: 537_600_000_000,
      instructionWeight: 150_000_000 * 6,
    });
  }

  constructor(api: ApiPromise) {
    this.api = api;
  }

  static async create(uri: string): Promise<OakApi> {
    const provider = new WsProvider(uri);
    const api = await ApiPromise.create({
      provider: provider,
      rpc: {
        automationTime: {
          generateTaskId: {
            description: "Getting task ID given account ID and provided ID",
            params: [
              {
                name: "accountId",
                type: "AccountId",
              },
              {
                name: "providedId",
                type: "Text",
              },
            ],
            type: "Hash",
          },
          getTimeAutomationFees: {
            description: "Retrieve automation fees",
            params: [
              {
                name: "action",
                type: "AutomationAction",
              },
              {
                name: "executions",
                type: "u32",
              },
            ],
            type: "Balance",
          },
          calculateOptimalAutostaking: {
            description: "Calculate the optimal period to restake",
            params: [
              {
                name: "principal",
                type: "i128",
              },
              {
                name: "collator",
                type: "AccountId",
              },
            ],
            type: "AutostakingResult",
          },
          getAutoCompoundDelegatedStakeTaskIds: {
            description: "Return autocompounding tasks by account",
            params: [
              {
                name: "account_id",
                type: "AccountId",
              },
            ],
            type: "Vec<Hash>",
          },
        },
        xcmpHandler: {
          fees: {
            description:
              "Return XCMP fee for a automationTime.scheduleXCMPTask",
            params: [
              {
                name: "encoded_xt",
                type: "Bytes",
              },
            ],
            type: "u64",
          },
          crossChainAccount: {
            description:
              "Find OAK's cross chain access account from an account",
            params: [
              {
                name: "account_id",
                type: "AccountId32",
              },
            ],
            type: "AccountId32",
          },
        },
      },
      types: {
        AutomationAction: {
          _enum: [
            "Notify",
            "NativeTransfer",
            "XCMP",
            "AutoCompoundDelgatedStake",
          ],
        },
        AutostakingResult: {
          period: "i32",
          apy: "f64",
        },
      },
    });
    return new OakApi(api!);
  }
}

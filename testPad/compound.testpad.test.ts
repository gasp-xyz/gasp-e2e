import { getEnvironmentRequiredVars } from "../utils/utils";
import { User } from "../utils/User";
import { alice, api, keyring, setupApi, setupUsers } from "../utils/setup";
import { testLog } from "../utils/Logger";
import { waitForEvent, waitForRewards } from "../utils/eventListeners";
import { Assets } from "../utils/Assets";
import { Sudo } from "../utils/sudo";
import { Xyk } from "../utils/xyk";
import { BN_MILLION, BN_ONE, BN_THOUSAND, BN_ZERO } from "gasp-sdk";
import { getNextAssetId } from "../utils/tx";
import { BN } from "@polkadot/util";
import { OakNode } from "../utils/Framework/Node/OakNode";
import { XToken } from "../utils/xToken";
import { AssetId, ChainId, ChainSpecs } from "../utils/ChainSpecs";
import { signSendFinalized, signSendSuccess } from "../utils/sign";
import { ProofOfStake } from "../utils/ProofOfStake";
import { Market } from "../utils/market";

const TUR_ID = new BN(7);
const TUR_ED = ChainSpecs.get(ChainId.Tur)!.assets.get(AssetId.Tur)!.ed;

/**
 * @group oak-network
 *
 * https://docs.google.com/document/d/1LSQyZKu5G_xHB-FXyDrYCqfmnq-R2euJw_jHpeHn4us/edit#heading=h.cr78w1wk9jwg
 */
describe("auto-compound story: auto compound rewards XCM task", () => {
  let userMangata: User;
  let oakApi: OakNode;
  let lpId: BN;

  beforeAll(async () => {
    await setupApi();
    setupUsers();
    userMangata = new User(keyring, "//Pistachio");

    const { oakUri } = getEnvironmentRequiredVars();
    oakApi = await OakNode.create(oakUri!);

    // init liquidity pool id to last id
    lpId = (await getNextAssetId()).sub(BN_ONE);
    // needs to be call just once before the test, please comment afterwards & uncomment LP init
    try {
      await setupAssets();
    } catch (e) {
      testLog.getLog().error(e);
    }
  });

  async function setupAssets() {
    testLog
      .getLog()
      .info("running section: send TUR to mangata for pool creation");

    await signSendSuccess(
      oakApi.api,
      oakApi.api.tx.utility.batchAll([
        oakApi.xTokenTransfer(
          ChainId.Mg,
          AssetId.Tur,
          AssetId.Tur.unit.mul(new BN(10_000)),
          userMangata,
        ),
        // existential deposit into mangata account on OAK, when paying fees account cannot be reaped
        oakApi.api.tx.balances.transfer(
          userMangata.keyRingPair.address,
          TUR_ED,
        ),
      ]),
      alice,
    );

    testLog.getLog().info("running section: setup pools & rewards for MG-TUR");
    const initIssuance = [
      Sudo.sudo(api.tx.issuance.finalizeTge()),
      Sudo.sudo(api.tx.issuance.initIssuanceConfig()),
      Assets.mintNative(userMangata, AssetId.Mgx.unit.mul(BN_MILLION)),
    ];

    lpId = await getNextAssetId();
    const initPool = [
      Sudo.sudoAs(
        userMangata,
        Market.createPool(
          BN_ZERO,
          AssetId.Mgx.unit.mul(BN_THOUSAND),
          TUR_ID,
          AssetId.Tur.unit.mul(BN_THOUSAND),
        ),
      ),
      ProofOfStake.updatePoolPromotion(lpId, 1),
      Sudo.sudoAs(
        userMangata,
        Xyk.activateLiquidity(lpId, new BN("500000005000000000000")),
      ),
    ];

    const proxy = await oakApi.api.rpc.xcmpHandler.crossChainAccount(
      userMangata.keyRingPair.address,
    );
    const proxyCall = [
      Sudo.sudoAs(
        userMangata,
        api.tx.proxy.addProxy(proxy, { AutoCompound: 0 }, 0),
      ),
    ];

    await Sudo.batchAsSudoFinalized(
      ...[initIssuance, initPool, proxyCall].flat(),
    );

    await waitForRewards(userMangata, lpId);
  }

  it("auto-compound: schedule & execute task", async () => {
    testLog.getLog().info("running section: prepare compound extrinsic");

    const tx = api.tx.proxy.proxy(
      userMangata.keyRingPair.address,
      undefined,
      api.tx.xyk.compoundRewards(lpId, BN_MILLION),
    );
    const encodedTxHex = tx.unwrap().toHex();
    const encodedTxInfo = await tx.paymentInfo(userMangata.keyRingPair);

    testLog.getLog().info(encodedTxHex);
    testLog.getLog().info("running section: schedule task: " + encodedTxHex);

    const taskIdLog = await oakApi.api.rpc.automationTime.generateTaskId(
      alice.keyRingPair.address,
      "compound",
    );
    testLog.getLog().info(`task id: ${taskIdLog}`);
    const taskId = "compound";
    // const seconds = Math.trunc(new Date().getTime() / 1000);
    // const nextHour = seconds - (seconds % HOUR) + HOUR;

    const executions = [0];
    const txCreate = oakApi.api.tx.automationTime.scheduleXcmpTask(
      // task id
      oakApi.api.createType("Vec<u8>", taskId),
      // intervals for task execution, 0 == immediate execution, only with 'features=dev_queue' oak build
      { Fixed: { executionTimes: executions } },
      // destination para id
      2110,
      // currency id - the registered TUR in this case
      0,
      // encoded call
      oakApi.api.createType("Vec<u8>", encodedTxHex),
      // extrinsic weight
      encodedTxInfo.weight,
    );

    const task = await oakApi.taskFees(encodedTxInfo, 1);
    const info = await txCreate.paymentInfo(userMangata.keyRingPair);
    const xcm = XToken.xcmTransferFee(ChainId.Tur, AssetId.Tur);
    const totalFees = task
      // scheduleXcmpTask extrinsic fee
      .add(new BN(info.partialFee))
      // xcm transfer fee on destination
      .add(xcm);

    testLog.getLog().info(`running section: fees to TUR network:
      task: ${task},
      scheduleXcmpTask extrinsic fee: ${info.partialFee},
      xcm fee: ${xcm},
      total: ${totalFees}
    `);

    // do the TUR swap
    // and send them over to TUR chain
    // get paymentInfo for this extrinsic and show to user the cost on managata
    await signSendFinalized(
      api.tx.utility.batchAll([
        Xyk.buyAsset(BN_ZERO, TUR_ID, totalFees),
        XToken.transfer(ChainId.Tur, AssetId.Tur, totalFees, userMangata),
      ]),
      userMangata,
    );

    await signSendSuccess(oakApi.api, txCreate, userMangata);

    testLog.getLog().info("running section: await execute task");
    // check the xcm automation success on oak
    await waitForEvent(oakApi.api, "automationTime.XcmpTaskSucceeded");
    // check that we have minted some liquidity
    await waitForEvent(api, "xyk.LiquidityMinted");

    const balance = (
      await oakApi.api.query.system.account(userMangata.keyRingPair.address)
    ).data.free;

    // does not hold because of dynamic inclusion fee in turing for each block, there will be some extra coins left
    // when 'oakApi.api.tx.automationTime.scheduleXcmpTask(' is executed
    // the fee will be a bit less than '.add(new BN(info.partialFee))'
    expect(TUR_ED).bnEqual(balance);
  });
});

/**
 * @group oak-network
 *
 * not a test, just print various fees taking place
 */
describe.skip("auto-compound story: check all fees", () => {
  let user1: User;
  let oakApi: OakNode;

  beforeAll(async () => {
    await setupApi();
    [user1] = setupUsers();
    user1 = alice;

    const { oakUri } = getEnvironmentRequiredVars();
    oakApi = await OakNode.create(oakUri!);
  });

  it("auto-compound: proxy fee", async () => {
    let feeInfo = await api.tx.proxy
      .addProxy(user1.keyRingPair.address, { AutoCompound: 0 }, 0)
      .paymentInfo(user1.keyRingPair);

    testLog.getLog().info(`auto-compound: proxy fee = ${feeInfo.partialFee}`);

    const tx = api.tx.proxy.proxy(
      user1.keyRingPair.address,
      undefined,
      api.tx.xyk.compoundRewards(8, BN_MILLION),
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
        { Fixed: { executionTimes: [0] } },
        // destination para id
        2110,
        // currency id - the registered TUR in this case
        0,
        // encoded call
        oakApi.api.createType("Vec<u8>", encodedCall),
        // extrinsic weight
        weight,
      )
      .paymentInfo(alice.keyRingPair);
    testLog
      .getLog()
      .info(
        `auto-compound: automation task create fee = ${feeInfo.partialFee}`,
      );

    const currencyData =
      await oakApi.api.query.xcmpHandler.xcmChainCurrencyData(2110, 0);
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

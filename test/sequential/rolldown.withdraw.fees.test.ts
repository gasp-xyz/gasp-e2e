/*
 *
 * @group withdrawal-rolldown
 */

import { ApiPromise } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { ETH_ASSET_ID, GASP_ASSET_ID } from "../../utils/Constants";
import { setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN_TEN, BN_THOUSAND, signTx } from "gasp-sdk";
import { Withdraw } from "../../utils/rolldown";
import { BN, BN_MILLION } from "@polkadot/util";
import {
  ExtrinsicResult,
  filterZeroEventData,
} from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { stringToBN } from "../../utils/utils";
import { getTokensAccountInfo } from "../../utils/tx";

let api: ApiPromise;
let testUser: User;
let gaspIdL1Asset: any;
let withdrawalAmount: BN;
let treasuryAccount: string;
let ethIdL1Asset: any;
let DEFAULT_AMOUNT: any;
let chain: any;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  api = getApi();
  gaspIdL1Asset = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(GASP_ASSET_ID)),
  );
  ethIdL1Asset = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(ETH_ASSET_ID)),
  );
  withdrawalAmount = BN_MILLION;
  treasuryAccount = "0x6d6f646c70792f74727372790000000000000000";
  DEFAULT_AMOUNT = BN_THOUSAND.mul(BN_TEN.pow(new BN(18)));
  chain = "Ethereum";
});

beforeEach(async () => {
  [testUser] = setupUsers();
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing GASP, some fees goes to treasury", async () => {
  const treasuryBalanceBefore = stringToBN(
    (await getTokensAccountInfo(treasuryAccount, GASP_ASSET_ID)).free,
  );
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
  const userBalanceBefore = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );

  const events = await signTx(
    getApi(),
    await Withdraw(testUser, withdrawalAmount, gaspIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  );
  const eventResponse = getEventResultFromMangataTx(events);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const transferEvent = filterZeroEventData(events, "Transfer");
  const withdrawalFee = stringToBN(transferEvent.amount);
  expect(transferEvent.from).toEqual(testUser.keyRingPair.address);
  expect(transferEvent.to).toEqual(treasuryAccount);
  const depositEvent = filterZeroEventData(events, "Deposited");
  const networkFees = stringToBN(depositEvent.amount);

  const treasuryBalanceAfter = stringToBN(
    (await getTokensAccountInfo(treasuryAccount, GASP_ASSET_ID)).free,
  );
  const userBalanceAfter = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );
  expect(treasuryBalanceAfter).bnEqual(
    treasuryBalanceBefore.add(withdrawalFee),
  );
  expect(userBalanceBefore).bnEqual(
    userBalanceAfter.add(withdrawalFee).add(withdrawalAmount).add(networkFees),
  );
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing Eth, some fees goes to treasury", async () => {
  const treasuryBalanceBefore = stringToBN(
    (await getTokensAccountInfo(treasuryAccount, GASP_ASSET_ID)).free,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintToken(ETH_ASSET_ID, testUser, DEFAULT_AMOUNT),
  );
  const userGaspBalanceBefore = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );
  const userEthBalanceBefore = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, ETH_ASSET_ID))
      .free,
  );

  const events = await signTx(
    getApi(),
    await Withdraw(testUser, withdrawalAmount, ethIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  );
  const eventResponse = getEventResultFromMangataTx(events);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const transferEvent = filterZeroEventData(events, "Transfer");
  const withdrawalFee = stringToBN(transferEvent.amount);
  expect(transferEvent.from).toEqual(testUser.keyRingPair.address);
  expect(transferEvent.to).toEqual(treasuryAccount);
  const depositEvent = filterZeroEventData(events, "Deposited");
  const networkFees = stringToBN(depositEvent.amount);

  const treasuryBalanceAfter = stringToBN(
    (await getTokensAccountInfo(treasuryAccount, GASP_ASSET_ID)).free,
  );
  const userGaspBalanceAfter = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );
  const userEthBalanceAfter = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, ETH_ASSET_ID))
      .free,
  );
  expect(treasuryBalanceAfter).bnEqual(
    treasuryBalanceBefore.add(withdrawalFee),
  );
  expect(userGaspBalanceBefore).bnEqual(
    userGaspBalanceAfter.add(withdrawalFee).add(networkFees),
  );
  expect(userEthBalanceBefore).bnEqual(
    userEthBalanceAfter.add(withdrawalAmount),
  );
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing ALL GASP, extrinsic fail", async () => {
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
  const userBalanceBefore = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );
  const events = await signTx(
    getApi(),
    await Withdraw(testUser, userBalanceBefore, gaspIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  );
  const eventResponse = getEventResultFromMangataTx(events);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
  expect(eventResponse.data).toEqual("NotEnoughAssets");
  const userBalanceAfter = stringToBN(
    (await getTokensAccountInfo(testUser.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );
  const depositEvent = filterZeroEventData(events, "Deposited");
  const networkFees = stringToBN(depositEvent.amount);
  expect(userBalanceBefore).bnEqual(userBalanceAfter.add(networkFees));
});

test("GIVEN a withdrawal, WHEN user having only Eth and withdrawing Eth, extrinsic fail", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(ETH_ASSET_ID, testUser, DEFAULT_AMOUNT),
  );
  await signTx(
    getApi(),
    await Withdraw(testUser, withdrawalAmount, ethIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NotEnoughAssetsForFee");
  });
});

test("Given a fee withdrawal payment, tokens go to Treasury", async () => {
  const [testUser2] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser2));
  const treasuryBalanceBefore = stringToBN(
    (await getTokensAccountInfo(treasuryAccount, GASP_ASSET_ID)).free,
  );
  const testUser2BalanceBefore = stringToBN(
    (await getTokensAccountInfo(testUser2.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );
  const events = await signTx(
    getApi(),
    await Withdraw(testUser, withdrawalAmount, gaspIdL1Asset.ethereum, chain),
    testUser2.keyRingPair,
  );
  const transferEvent = filterZeroEventData(events, "Transfer");
  const withdrawalFee = stringToBN(transferEvent.amount);
  const depositEvent = filterZeroEventData(events, "Deposited");
  const networkFees = stringToBN(depositEvent.amount);
  expect(transferEvent.from).toEqual(testUser2.keyRingPair.address);
  expect(transferEvent.to).toEqual(treasuryAccount);

  const treasuryBalanceAfter = stringToBN(
    (await getTokensAccountInfo(treasuryAccount, GASP_ASSET_ID)).free,
  );
  const testUser2BalanceAfter = stringToBN(
    (await getTokensAccountInfo(testUser2.keyRingPair.address, GASP_ASSET_ID))
      .free,
  );
  expect(treasuryBalanceAfter).bnEqual(
    treasuryBalanceBefore.add(withdrawalFee),
  );
  expect(testUser2BalanceBefore).bnEqual(
    testUser2BalanceAfter
      .add(withdrawalFee)
      .add(withdrawalAmount)
      .add(networkFees),
  );
});

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
import { Rolldown } from "../../utils/rollDown/Rolldown";
import {
  ExtrinsicResult,
  filterZeroEventData,
} from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

let api: ApiPromise;
let testUser: User;
let gaspIdL1Asset: any;
let withdrawalAmount: BN;
let waitingBatchPeriod: number;
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
  waitingBatchPeriod = Rolldown.getMerkleRootBatchPeriod(3);
  treasuryAccount = "0x6d6f646c70792f74727372790000000000000000";
  DEFAULT_AMOUNT = BN_THOUSAND.mul(BN_TEN.pow(new BN(18)));
  chain = "Ethereum";
});

beforeEach(async () => {
  [testUser] = setupUsers();
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing GASP, some fees goes to treasury", async () => {
  const treasuryBalanceBefore = await api.query.tokens.accounts(
    treasuryAccount,
    GASP_ASSET_ID,
  );
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
  const events = await signTx(
    getApi(),
    await Withdraw(testUser, withdrawalAmount, gaspIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  );
  await Rolldown.waitForNextBatchCreated("Ethereum", waitingBatchPeriod);
  const eventFiltered = filterZeroEventData(events, "Transfer");
  const transferAmountBefore = eventFiltered.amount.replaceAll(",", "");
  const transferAmount = new BN(transferAmountBefore);
  expect(eventFiltered.from).toEqual(testUser.keyRingPair.address);
  expect(eventFiltered.to).toEqual(treasuryAccount);
  const treasuryBalanceAfter = await api.query.tokens.accounts(
    treasuryAccount,
    GASP_ASSET_ID,
  );
  expect(treasuryBalanceAfter.free).bnEqual(
    treasuryBalanceBefore.free.add(transferAmount),
  );
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing Eth, some fees goes to treasury", async () => {
  const treasuryBalanceBefore = await api.query.tokens.accounts(
    treasuryAccount,
    GASP_ASSET_ID,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintToken(ETH_ASSET_ID, testUser, DEFAULT_AMOUNT),
  );
  const events = await signTx(
    getApi(),
    await Withdraw(testUser, withdrawalAmount, ethIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  );
  await Rolldown.waitForNextBatchCreated("Ethereum", waitingBatchPeriod);
  const eventFiltered = filterZeroEventData(events, "Transfer");
  const transferAmountBefore = eventFiltered.amount.replaceAll(",", "");
  const transferAmount = new BN(transferAmountBefore);
  expect(eventFiltered.from).toEqual(testUser.keyRingPair.address);
  expect(eventFiltered.to).toEqual(treasuryAccount);
  const treasuryBalanceAfter = await api.query.tokens.accounts(
    treasuryAccount,
    GASP_ASSET_ID,
  );
  expect(treasuryBalanceAfter.free).bnEqual(
    treasuryBalanceBefore.free.add(transferAmount),
  );
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing ALL GASP, extrinsic fail", async () => {
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
  const tokenAmount = await api.query.tokens.accounts(
    testUser.keyRingPair.address,
    GASP_ASSET_ID,
  );
  await signTx(
    getApi(),
    await Withdraw(testUser, tokenAmount.free, gaspIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NotEnoughAssets");
  });
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
  const treasuryBalanceBefore = await api.query.tokens.accounts(
    treasuryAccount,
    GASP_ASSET_ID,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintNative(testUser2),
  );
  const events = await signTx(
    getApi(),
    await Withdraw(testUser, withdrawalAmount, gaspIdL1Asset.ethereum, chain),
    testUser2.keyRingPair,
  );
  await Rolldown.waitForNextBatchCreated("Ethereum", waitingBatchPeriod);
  const transferEvent = filterZeroEventData(events, "Transfer");
  const transferAmountBefore = transferEvent.amount.replaceAll(",", "");
  const transferAmount = new BN(transferAmountBefore);
  expect(transferEvent.from).toEqual(testUser2.keyRingPair.address);
  expect(transferEvent.to).toEqual(treasuryAccount);
  const treasuryBalanceAfter = await api.query.tokens.accounts(
    treasuryAccount,
    GASP_ASSET_ID,
  );
  expect(treasuryBalanceAfter.free).bnEqual(
    treasuryBalanceBefore.free.add(transferAmount),
  );
});

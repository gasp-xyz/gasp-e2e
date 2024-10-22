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
  filterAndStringifyFirstEvent,
} from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { stringToBN } from "../../utils/utils";
import { getTokensAccountInfo } from "../../utils/tx";

let api: ApiPromise;
let testUser: User;
let gaspIdL1Asset: any;
let ethIdL1Asset: any;

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
});

beforeEach(async () => {
  [testUser] = setupUsers();
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing GASP, some fees goes to treasury", async () => {
  const treasuryAccount = "0x6d6f646c70792f74727372790000000000000000";
  const chain = "Ethereum";
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
    await Withdraw(testUser, BN_MILLION, gaspIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  );
  const eventResponse = getEventResultFromMangataTx(events);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const transferEvent = filterAndStringifyFirstEvent(events, "Transfer");
  const withdrawalFee = stringToBN(transferEvent.amount);
  expect(transferEvent.from).toEqual(testUser.keyRingPair.address);
  expect(transferEvent.to).toEqual(treasuryAccount);
  const transactionEvent = filterAndStringifyFirstEvent(
    events,
    "TransactionFeePaid",
  );
  const transactionFee = stringToBN(transactionEvent.actualFee);

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
    userBalanceAfter.add(withdrawalFee).add(BN_MILLION).add(transactionFee),
  );
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing Eth, some fees goes to treasury", async () => {
  const treasuryAccount = "0x6d6f646c70792f74727372790000000000000000";
  const mintingAmount = BN_THOUSAND.mul(BN_TEN.pow(new BN(18)));
  const chain = "Ethereum";
  const treasuryBalanceBefore = stringToBN(
    (await getTokensAccountInfo(treasuryAccount, GASP_ASSET_ID)).free,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintToken(ETH_ASSET_ID, testUser, mintingAmount),
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
    await Withdraw(testUser, BN_MILLION, ethIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  );
  const eventResponse = getEventResultFromMangataTx(events);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const transferEvent = filterAndStringifyFirstEvent(events, "Transfer");
  const withdrawalFee = stringToBN(transferEvent.amount);
  expect(transferEvent.from).toEqual(testUser.keyRingPair.address);
  expect(transferEvent.to).toEqual(treasuryAccount);
  const transactionEvent = filterAndStringifyFirstEvent(
    events,
    "TransactionFeePaid",
  );
  const transactionFee = stringToBN(transactionEvent.actualFee);

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
    userGaspBalanceAfter.add(withdrawalFee).add(transactionFee),
  );
  expect(userEthBalanceBefore).bnEqual(userEthBalanceAfter.add(BN_MILLION));
});

test("GIVEN a withdrawal, WHEN paying with GASP and withdrawing ALL GASP, extrinsic fail", async () => {
  const chain = "Ethereum";
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
  const transactionEvent = filterAndStringifyFirstEvent(
    events,
    "TransactionFeePaid",
  );
  const transactionFee = stringToBN(transactionEvent.actualFee);
  expect(userBalanceBefore).bnEqual(userBalanceAfter.add(transactionFee));
});

test("GIVEN a withdrawal, WHEN user having only Eth and withdrawing Eth, extrinsic fail", async () => {
  const chain = "Ethereum";
  const mintingAmount = BN_THOUSAND.mul(BN_TEN.pow(new BN(18)));
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(ETH_ASSET_ID, testUser, mintingAmount),
  );
  await signTx(
    getApi(),
    await Withdraw(testUser, BN_MILLION, ethIdL1Asset.ethereum, chain),
    testUser.keyRingPair,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NotEnoughAssetsForFee");
  });
});

test("Given a fee withdrawal payment WHEN withdrawal is sent from another account THEN the fee is deducted from from sender's account", async () => {
  const chain = "Ethereum";
  const treasuryAccount = "0x6d6f646c70792f74727372790000000000000000";
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
    await Withdraw(testUser, BN_MILLION, gaspIdL1Asset.ethereum, chain),
    testUser2.keyRingPair,
  );
  const transferEvent = filterAndStringifyFirstEvent(events, "Transfer");
  const withdrawalFee = stringToBN(transferEvent.amount);
  const transactionEvent = filterAndStringifyFirstEvent(
    events,
    "TransactionFeePaid",
  );
  const transactionFee = stringToBN(transactionEvent.actualFee);
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
      .add(BN_MILLION)
      .add(transactionFee),
  );
});

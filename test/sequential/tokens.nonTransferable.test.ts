/*
 *
 * @group nonTransToken
 */

import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import {
  ExtrinsicResult,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Tokens } from "../../utils/tokens";
import {
  getEventErrorFromSudo,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { FoundationMembers } from "../../utils/FoundationMembers";
import { Market } from "../../utils/market";
import { BN } from "ethereumjs-util/dist/externals";
import { BN_THOUSAND, BN_ZERO, signTx } from "gasp-sdk";
import { getLiquidityAssetId } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let sudo: User;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await setupApi();
  await setupUsers();
  sudo = getSudoUser();
});

test("[Flipped] Non-transferable token can't be minted", async () => {
  await Sudo.batchAsSudoFinalized(Assets.mintToken(GASP_ASSET_ID, sudo)).then(
    async (events) => {
      await waitSudoOperationSuccess(events);
    },
  );
});

test("[Flipped] Non-transferable token can't be transferred", async () => {
  const [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Tokens.transfer(testUser, GASP_ASSET_ID),
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("Founder can create GASP pool", async () => {
  let foundationMembers: any;

  foundationMembers = await FoundationMembers.getFoundationMembers();

  const [tokenId] = await Assets.setupUserWithCurrencies(
    sudo,
    [new BN(250000)],
    sudo,
  );

  //Since we can't add GASP tokens to the founder, we need to add sudo to FoundationMembers
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationMembers[2],
      FoundationMembers.changeKey(sudo.keyRingPair.address),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).toContain(sudo.keyRingPair.address);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      Market.createPool(GASP_ASSET_ID, BN_THOUSAND, tokenId, BN_THOUSAND),
    ),
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const poolId = await getLiquidityAssetId(GASP_ASSET_ID, tokenId);
  expect(poolId).bnGt(BN_ZERO);
});

test("[Flipped] Ordinary user can't create GASP pool", async () => {
  let foundationMembers: any;

  foundationMembers = await FoundationMembers.getFoundationMembers();

  if (foundationMembers.includes(sudo.keyRingPair.address)) {
    const [testUser] = setupUsers();
    await Sudo.asSudoFinalized(
      Sudo.sudoAs(
        sudo,
        FoundationMembers.changeKey(testUser.keyRingPair.address),
      ),
    );
  }

  foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).not.toContain(sudo.keyRingPair.address);

  const [tokenId] = await Assets.setupUserWithCurrencies(
    sudo,
    [new BN(250000)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      Market.createPool(GASP_ASSET_ID, BN_THOUSAND, tokenId, BN_THOUSAND),
    ),
  ).then(async (events) => {
    const errorEvent = await getEventErrorFromSudo(events);
    expect(errorEvent.state).toBe(ExtrinsicResult.ExtrinsicSuccess);
  });

  const poolId = await getLiquidityAssetId(GASP_ASSET_ID, tokenId);
  expect(poolId).bnGt(BN_ZERO);
});

test("[Flipped] Non-transferable token can't be sold", async () => {
  //Add sudo to FoundationMembers to create a pool
  const foundationMembers = await FoundationMembers.getFoundationMembers();

  const [tokenId] = await Assets.setupUserWithCurrencies(
    sudo,
    [new BN(250000)],
    sudo,
  );

  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationMembers[2],
      FoundationMembers.changeKey(sudo.keyRingPair.address),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      Market.createPool(GASP_ASSET_ID, BN_THOUSAND, tokenId, BN_THOUSAND),
    ),
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const poolId = await getLiquidityAssetId(GASP_ASSET_ID, tokenId);
  expect(poolId).bnGt(BN_ZERO);

  const api = getApi();
  await signTx(
    api,
    Market.sellAsset(poolId, GASP_ASSET_ID, tokenId, new BN(1000)),
    sudo.keyRingPair,
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

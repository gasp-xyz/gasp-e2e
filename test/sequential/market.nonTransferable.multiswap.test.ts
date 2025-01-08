import { jest } from "@jest/globals";
import { BN } from "ethereumjs-util";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { FoundationMembers } from "../../utils/FoundationMembers";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { BN_BILLION } from "@polkadot/util";
import { Sudo } from "../../utils/sudo";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Market } from "../../utils/market";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_MILLION, BN_THOUSAND, BN_ZERO } from "gasp-sdk";
import { sellAsset } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let sudo: User;
let token1: BN;
let token2: BN;
let token3: BN;
let token4: BN;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await setupApi();
  await setupUsers();
  sudo = getSudoUser();

  const api = getApi();
  const a = await api.query.xyk.pools([]);
  expect(a).not.toBeEmpty();
  expect(a).toBeEmpty();
});

beforeEach(async () => {
  let foundationMembers: any;

  foundationMembers = await FoundationMembers.getFoundationMembers();

  [token1, token2, token3, token4] = await Assets.setupUserWithCurrencies(
    sudo,
    [BN_BILLION, BN_BILLION, BN_BILLION, BN_BILLION],
    sudo,
  );

  const oldFounder = foundationMembers[2];

  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(oldFounder, FoundationMembers.changeKey(sudo)),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).toContain(sudo.keyRingPair.address);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      sudo,
      Market.createPool(token1, BN_MILLION, token2, BN_MILLION, "StableSwap"),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        token2,
        BN_MILLION,
        GASP_ASSET_ID,
        BN_MILLION,
        "StableSwap",
      ),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(
        GASP_ASSET_ID,
        BN_MILLION,
        token3,
        BN_MILLION,
        "StableSwap",
      ),
    ),
    Sudo.sudoAs(
      sudo,
      Market.createPool(token3, BN_MILLION, token4, BN_MILLION),
    ),
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await Sudo.asSudoFinalized(
    Sudo.sudoAs(sudo, getApi().tx.foundationMembers.changeKey(oldFounder)),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("User can buy GASP in multiswap operation", async () => {
  await sellAsset(
    sudo.keyRingPair,
    token1,
    GASP_ASSET_ID,
    BN_THOUSAND,
    BN_ZERO,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "xyk",
      "AssetsSwapped",
      sudo.keyRingPair.address,
    ]);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    return result;
  });
});

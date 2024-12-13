import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import {
  ExtrinsicResult,
  waitSudoOperationFail,
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
import { BN_THOUSAND, BN_ZERO } from "gasp-sdk";
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

test("Non-transferable token can't be minted", async () => {
  await Sudo.batchAsSudoFinalized(Assets.mintToken(GASP_ASSET_ID, sudo)).then(
    async (events) => {
      await waitSudoOperationFail(events, ["NontransferableToken"]);
    },
  );
});

test("Non-transferable token can't be transfered", async () => {
  const [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Tokens.transfer(testUser, GASP_ASSET_ID),
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("NontransferableToken");
  });
});

test("Founder can create GASP pool", async () => {
  let foundationMembers: any;

  foundationMembers = await FoundationMembers.getFoundationMembers();

  const [firstCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [new BN(250000)],
    sudo,
  );

  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationMembers[2],
      FoundationMembers.changeKey(sudo),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).toContain(sudo.keyRingPair.address);

  await Sudo.batchAsSudoFinalized(
    await Sudo.sudoAs(
      sudo,
      Market.createPool(GASP_ASSET_ID, BN_THOUSAND, firstCurrency, BN_THOUSAND),
    ),
  ).then((events) => {
    const eventResponse = getEventResultFromMangataTx(events);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const poolId = await getLiquidityAssetId(GASP_ASSET_ID, firstCurrency);
  expect(poolId).bnGt(BN_ZERO);
});

test("Ordinary user can't create GASP pool", async () => {
  let foundationMembers: any;

  foundationMembers = await FoundationMembers.getFoundationMembers();

  if (foundationMembers.includes(sudo.keyRingPair.address)) {
    const [testUser] = setupUsers();
    await Sudo.asSudoFinalized(
      Sudo.sudoAs(sudo, FoundationMembers.changeKey(testUser)),
    );
  }

  foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).not.toContain(sudo.keyRingPair.address);

  const [firstCurrency] = await Assets.setupUserWithCurrencies(
    sudo,
    [new BN(250000)],
    sudo,
  );

  await Sudo.batchAsSudoFinalized(
    await Sudo.sudoAs(
      sudo,
      Market.createPool(GASP_ASSET_ID, BN_THOUSAND, firstCurrency, BN_THOUSAND),
    ),
  ).then(async (events) => {
    const errorEvent = await getEventErrorFromSudo(events);
    expect(errorEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
    expect(errorEvent.data).toBe("NontransferableToken");
  });

  const poolId = await getLiquidityAssetId(GASP_ASSET_ID, firstCurrency);
  expect(poolId).bnLt(BN_ZERO);
});

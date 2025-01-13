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
import {
  ExtrinsicResult,
  waitSudoOperationFail,
  waitSudoOperationSuccess,
} from "../../utils/eventListeners";
import { Market } from "../../utils/market";
import { GASP_ASSET_ID } from "../../utils/Constants";
import {
  BN_HUNDRED_BILLIONS,
  BN_MILLION,
  BN_TEN_THOUSAND,
  BN_ZERO,
  MangataGenericEvent,
} from "gasp-sdk";
import { getLiquidityAssetId } from "../../utils/tx";
import { ApiPromise } from "@polkadot/api";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let api: ApiPromise;
let sudo: User;
let testUser: string;
let token1: BN;
let token2: BN;
let token3: BN;
let token4: BN;
let token5: BN;
let token6: BN;
let liqIds: BN[];

async function getStablePoolId(events: MangataGenericEvent[]) {
  const poolIds: BN[] = [];
  let poolId: BN;
  let i = 0;
  const poolCreatedEvents = JSON.parse(
    JSON.stringify(events.filter((events) => events.method === "PoolCreated")),
  );
  const length = poolCreatedEvents.length;
  while (i < length - 1) {
    poolId = new BN(poolCreatedEvents[i].event.data[1]);
    poolIds.push(poolId);
    i++;
  }
  return poolIds;
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  await setupApi();
  await setupUsers();
  sudo = getSudoUser();
  testUser = "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc";
  api = getApi();
});

beforeEach(async () => {
  let foundationMembers: any;

  foundationMembers = await FoundationMembers.getFoundationMembers();

  [token1, token2, token3, token4, token5, token6] =
    await Assets.setupUserWithCurrencies(
      sudo,
      [BN_BILLION, BN_BILLION, BN_BILLION, BN_BILLION, BN_BILLION, BN_BILLION],
      sudo,
    );

  const oldFounder2 = foundationMembers[2];
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      oldFounder2,
      api.tx.foundationMembers.changeKey(testUser),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  foundationMembers = await FoundationMembers.getFoundationMembers();
  expect(foundationMembers).toContain(testUser);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudo(api.tx.tokens.mint(token1, testUser, BN_HUNDRED_BILLIONS)),
    Sudo.sudo(api.tx.tokens.mint(token2, testUser, BN_HUNDRED_BILLIONS)),
    Sudo.sudo(api.tx.tokens.mint(token3, testUser, BN_HUNDRED_BILLIONS)),
    Sudo.sudo(api.tx.tokens.mint(token4, testUser, BN_HUNDRED_BILLIONS)),
    Sudo.sudo(api.tx.tokens.mint(token5, testUser, BN_HUNDRED_BILLIONS)),
    Sudo.sudo(api.tx.tokens.mint(token6, testUser, BN_HUNDRED_BILLIONS)),
  );
  const poolEvents = await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.createPool(token1, BN_MILLION, token2, BN_MILLION, "StableSwap"),
    ),
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.createPool(
        token2,
        BN_MILLION,
        GASP_ASSET_ID,
        BN_MILLION,
        "StableSwap",
      ),
    ),
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.createPool(
        GASP_ASSET_ID,
        BN_MILLION,
        token3,
        BN_MILLION,
        "StableSwap",
      ),
    ),
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.createPool(token3, BN_MILLION, token4, BN_MILLION, "StableSwap"),
    ),
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.createPool(token4, BN_MILLION, token5, BN_MILLION, "StableSwap"),
    ),
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.createPool(token5, BN_MILLION, token6, BN_MILLION),
    ),
  );
  const eventResponse = getEventResultFromMangataTx(poolEvents);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  liqIds = await getStablePoolId(poolEvents);
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser,
      api.tx.foundationMembers.changeKey(oldFounder2),
    ),
  ).then((events) => {
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

test("User can buy GASP in multiswap operation", async () => {
  const userBalanceBeforeSwap = await api.query.tokens.accounts(
    testUser,
    token1,
  );
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.multiswapAssetSell(
        [liqIds[0], liqIds[1]],
        token1,
        BN_TEN_THOUSAND,
        GASP_ASSET_ID,
        BN_ZERO,
      ),
    ),
  ).then(async (result) => {
    await waitSudoOperationSuccess(result, "SudoAsDone");
  });
  const userBalanceAfterSwap = await api.query.tokens.accounts(
    testUser,
    token1,
  );
  expect(userBalanceAfterSwap.free).bnEqual(
    userBalanceBeforeSwap.free.sub(BN_TEN_THOUSAND),
  );
});

test("User can't sell GASP in multiswap operation (GASP token at the beginning)", async () => {
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.multiswapAssetSell(
        [liqIds[1], liqIds[0]],
        GASP_ASSET_ID,
        BN_TEN_THOUSAND,
        token1,
        BN_ZERO,
      ),
    ),
  ).then(async (result) => {
    await waitSudoOperationFail(result, ["NontransferableToken"], "SudoAsDone");
  });
});

test("User can't sell GASP in multiswap operation (GASP token in the middle)", async () => {
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.multiswapAssetSell(
        [liqIds[1], liqIds[2]],
        token2,
        BN_TEN_THOUSAND,
        token3,
        BN_ZERO,
      ),
    ),
  ).then(async (result) => {
    await waitSudoOperationFail(result, ["NontransferableToken"], "SudoAsDone");
  });
});

test("Happy path - multiswap with only stable pools", async () => {
  const userBalance1BeforeSwap = await api.query.tokens.accounts(
    testUser,
    token3,
  );
  const userBalance2BeforeSwap = await api.query.tokens.accounts(
    testUser,
    token5,
  );
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.multiswapAssetSell(
        [liqIds[3], liqIds[4]],
        token3,
        BN_TEN_THOUSAND,
        token5,
        BN_ZERO,
      ),
    ),
  ).then(async (result) => {
    await waitSudoOperationSuccess(result, "SudoAsDone");
  });
  const userBalance1AfterSwap = await api.query.tokens.accounts(
    testUser,
    token3,
  );
  const userBalance2AfterSwap = await api.query.tokens.accounts(
    testUser,
    token5,
  );
  expect(userBalance1AfterSwap.free).bnEqual(
    userBalance1BeforeSwap.free.sub(BN_TEN_THOUSAND),
  );
  expect(userBalance2AfterSwap.free).bnGt(userBalance2BeforeSwap.free);
});

test("Happy path - multiswap with stable and xyk pools", async () => {
  liqIds[5] = await getLiquidityAssetId(token5, token6);

  const userBalance1BeforeSwap = await api.query.tokens.accounts(
    testUser,
    token4,
  );
  const userBalance2BeforeSwap = await api.query.tokens.accounts(
    testUser,
    token6,
  );
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      testUser,
      Market.multiswapAssetSell(
        [liqIds[4], liqIds[5]],
        token4,
        BN_TEN_THOUSAND,
        token6,
        BN_ZERO,
      ),
    ),
  ).then(async (result) => {
    await waitSudoOperationSuccess(result, "SudoAsDone");
  });
  const userBalance1AfterSwap = await api.query.tokens.accounts(
    testUser,
    token4,
  );
  const userBalance2AfterSwap = await api.query.tokens.accounts(
    testUser,
    token6,
  );
  expect(userBalance1AfterSwap.free).bnEqual(
    userBalance1BeforeSwap.free.sub(BN_TEN_THOUSAND),
  );
  expect(userBalance2AfterSwap.free).bnGt(userBalance2BeforeSwap.free);
});

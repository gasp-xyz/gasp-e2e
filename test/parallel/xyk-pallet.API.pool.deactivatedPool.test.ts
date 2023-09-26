/*
 *
 * @group xyk
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { BN } from "@polkadot/util";
import "jest-extended";
import { createPool, getLiquidityAssetId, mintLiquidity } from "../../utils/tx";
import {
  getBalanceOfPool,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { BN_ZERO } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);

process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let token1: BN;
let liquidityId: BN;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);

  await setupApi();

  [testUser1, testUser2] = setupUsers();
});

beforeEach(async () => {
  [token1] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo
  );

  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser1),
    Assets.mintToken(token1, testUser2, Assets.DEFAULT_AMOUNT),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        MGA_ASSET_ID,
        defaultCurrencyValue,
        token1,
        defaultCurrencyValue
      )
    )
  );

  liquidityId = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Xyk.burnLiquidity(MGA_ASSET_ID, token1, defaultCurrencyValue)
    )
  );

  const deactivatedPoolBalance = await getBalanceOfPool(MGA_ASSET_ID, token1);

  expect(deactivatedPoolBalance[0][0]).bnEqual(BN_ZERO);
});

test("GIVEN deactivated pool WHEN other user tries to create equal pool THEN receive error", async () => {
  await createPool(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    defaultCurrencyValue,
    token1,
    defaultCurrencyValue
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("PoolAlreadyExists");
  });
});

test("GIVEN deactivated pool WHEN other user tries to mint liquidity in pool THEN user can do this", async () => {
  await mintLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const deactivatedPoolBalance = await getBalanceOfPool(MGA_ASSET_ID, token1);

  expect(deactivatedPoolBalance[0][0]).bnGt(BN_ZERO);
});

test("GIVEN deactivated pool WHEN the user mints liquidity in pool again THEN liquidity IDs are equal", async () => {
  await mintLiquidity(
    testUser2.keyRingPair,
    MGA_ASSET_ID,
    token1,
    defaultCurrencyValue
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const liquidityIdAfter = await getLiquidityAssetId(MGA_ASSET_ID, token1);

  expect(liquidityIdAfter).bnEqual(liquidityId);
});

/*
 *
 * @group xyk
 * @group asset
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi } from "../../utils/api";
import { xykErrors } from "../../utils/utils";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import { ExtrinsicResult, findEventData } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN, hexToU8a } from "@polkadot/util";
import { BN_ONE, BN_TEN, MangataGenericEvent } from "gasp-sdk";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Xyk } from "../../utils/xyk";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { signSendFinalized } from "../../utils/sign";

jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());

let sudo: User;
let testUser1: User;

async function setupUserAssetRegister(
  user: User,
  extrinsicSuccess: boolean,
  eventErrorData?: string,
) {
  const api = getApi();

  const assetId = (
    await Assets.setupUserWithCurrencies(user, [new BN(250000)], sudo, true)
  )[0];

  const userRegisterAsset = await user.registerAsset(assetId);

  const assetTotalIssuance = await api.query.tokens.totalIssuance(assetId);
  const assetMetadata = await api.query.assetRegistry.metadata(assetId);
  if (extrinsicSuccess === true) {
    expect(getEventResultFromMangataTx(userRegisterAsset).state).toEqual(
      ExtrinsicResult.ExtrinsicSuccess,
    );
    expect(assetTotalIssuance.toNumber()).toEqual(250000);
    //@ts-ignore
    expect(assetMetadata.value.name.toHuman()).toEqual("TEST_TOKEN-" + assetId);
  } else {
    expect(getEventResultFromMangataTx(userRegisterAsset).state).toEqual(
      ExtrinsicResult.ExtrinsicFailed,
    );
    expect(getEventResultFromMangataTx(userRegisterAsset).data).toContain(
      eventErrorData,
    );
  }
  return assetId;
}

async function findAssetError(userRegisterNewAsset: MangataGenericEvent[]) {
  const api = getApi();

  const filterRegisterAsset = userRegisterNewAsset.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid",
  );

  const userAssetErr = hexToU8a(
    //@ts-ignore
    filterRegisterAsset[0].event.data[0].asErr.value.error.toString(),
  );

  const userAssetIndex =
    //@ts-ignore
    filterRegisterAsset[0].event.data[0].asErr.value.index.toString();

  return api?.registry.findMetaError({
    error: userAssetErr,
    index: new BN(userAssetIndex),
  });
}

beforeAll(async () => {
  await setupApi();
  setupUsers();
  const keyring = new Keyring({ type: "ethereum" });
  sudo = getSudoUser();
  testUser1 = new User(keyring);
  keyring.addPair(testUser1.keyRingPair);
  await testUser1.addGASPTokens(sudo);
});

test("register new asset from sudo user", async () => {
  await setupUserAssetRegister(sudo, true);
});

test("try to register a new asset from non-sudo user, expect to fail", async () => {
  await setupUserAssetRegister(testUser1, false, "RequireSudo");
});

test("register new asset and then update it by sudo user", async () => {
  const api = getApi();

  const assetId = await setupUserAssetRegister(sudo, true);

  const userUpdateAsset = await sudo.updateAsset(assetId);

  expect(getEventResultFromMangataTx(userUpdateAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );

  const assetMetadata = await api.query.assetRegistry.metadata(assetId);
  //@ts-ignore
  expect(assetMetadata.value.name.toHuman()).toEqual("TESTUPDT-" + assetId);
});

test("register new asset and then update it by non sudo user, expect to fail", async () => {
  const assetId = await setupUserAssetRegister(sudo, true);

  const userUpdateAsset = await testUser1.updateAsset(assetId);

  expect(getEventResultFromMangataTx(userUpdateAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicFailed,
  );

  expect(getEventResultFromMangataTx(userUpdateAsset).data).toContain(
    "RequireSudo",
  );
});

test("register new asset and then update it without fee", async () => {
  const api = getApi();

  const assetId = await setupUserAssetRegister(sudo, true);

  const userUpdateAsset = await Sudo.asSudoFinalized(
    Assets.updateAsset(assetId, {
      metadata: undefined,
    }),
  );

  expect(getEventResultFromMangataTx(userUpdateAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess,
  );

  const assetMetadata = await api.query.assetRegistry.metadata(assetId);
  expect(assetMetadata.value.additional.toHuman()).toEqual({
    xcm: null,
    xyk: null,
  });
});

test("register asset and then try to register new one with the same assetId, expect to conflict", async () => {
  const assetId = await setupUserAssetRegister(sudo, true);

  const tempAssetId = assetId.add(new BN(1));

  const userRegisterNewAsset = await sudo.registerAsset(assetId, tempAssetId);

  const userAssetMetaError = await findAssetError(userRegisterNewAsset);

  expect(userAssetMetaError.method).toEqual("ConflictingAssetId");
});

test("register asset with xyk disabled and try to create a pool, expect to fail", async () => {
  const register = Assets.registerAsset(
    "Disabled Xyk",
    "Disabled Xyk",
    10,
    undefined,
    { operationsDisabled: true },
  );
  const result = await Sudo.asSudoFinalized(register);
  // assetRegistry.RegisteredAsset [8,{"decimals":10,"name":"0x44697361626c65642058796b","symbol":"0x44697361626c65642058796b","existentialDeposit":0,"location":null,"additional":{"xcm":null,"xyk":{"operationsDisabled":true}}}]
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset",
  ).assetId;

  await expect(
    signSendFinalized(
      Xyk.createPool(assetId, BN_ONE, GASP_ASSET_ID, BN_ONE),
      testUser1,
    ),
  ).rejects.toEqual(
    expect.objectContaining({
      state: ExtrinsicResult.ExtrinsicFailed,
      data: xykErrors.FunctionNotAvailableForThisToken,
    }),
  );
});

test("register asset with xyk undefined and try to create a pool, expect success", async () => {
  const register = Assets.registerAsset(
    "None Xyk",
    "None Xyk",
    10,
    undefined,
    undefined,
    undefined,
  );
  const result = await Sudo.asSudoFinalized(register);
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset",
  ).assetId;

  await Sudo.asSudoFinalized(Assets.mintToken(assetId, testUser1, BN_TEN));

  await signSendFinalized(
    Xyk.createPool(assetId, BN_ONE, GASP_ASSET_ID, BN_ONE),
    testUser1,
  );
});

test("register asset with xyk enabled and try to create a pool, expect success", async () => {
  const register = Assets.registerAsset(
    "None Xyk",
    "None Xyk",
    10,
    undefined,
    { operationsDisabled: false },
  );
  const result = await Sudo.asSudoFinalized(register);
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset",
  ).assetId;

  await Sudo.asSudoFinalized(Assets.mintToken(assetId, testUser1, BN_TEN));

  await signSendFinalized(
    Xyk.createPool(assetId, BN_ONE, GASP_ASSET_ID, BN_ONE),
    testUser1,
  );
});

/*
 *
 * @group xyk
 * @group asset
 * @group parallel
 */
import { getApi } from "../../utils/api";
import { getEnvironmentRequiredVars, xykErrors } from "../../utils/utils";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import {
  ExtrinsicResult,
  findEventData,
  signSendFinalized,
} from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN, hexToU8a } from "@polkadot/util";
import { BN_ONE, BN_ZERO, MangataGenericEvent } from "@mangata-finance/sdk";
import { getNextAssetId } from "../../utils/tx";
import { Xyk } from "../../utils/xyk";
import { setupApi } from "../../utils/setup";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());

let sudo: User;
let testUser1: User;

async function setupUserAssetRegister(
  user: User,
  extrinsicSuccess: boolean,
  eventErrorData?: string
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
      ExtrinsicResult.ExtrinsicSuccess
    );
    expect(assetTotalIssuance.toNumber()).toEqual(250000);
    //@ts-ignore
    expect(assetMetadata.value.name.toHuman()).toEqual("TESTTOKEN-" + assetId);
  } else {
    expect(getEventResultFromMangataTx(userRegisterAsset).state).toEqual(
      ExtrinsicResult.ExtrinsicFailed
    );
    expect(getEventResultFromMangataTx(userRegisterAsset).data).toContain(
      eventErrorData
    );
  }
  return assetId;
}

async function findAssetError(userRegisterNewAsset: MangataGenericEvent[]) {
  const api = getApi();

  const filterRegisterAsset = userRegisterNewAsset.filter(
    (extrinsicResult) => extrinsicResult.method === "Sudid"
  );

  const userAssetErr = hexToU8a(
    //@ts-ignore
    filterRegisterAsset[0].event.data[0].asErr.value.error.toString()
  );

  const userAssetIndex =
    //@ts-ignore
    filterRegisterAsset[0].event.data[0].asErr.value.index.toString();

  const userAssetMetaError = api?.registry.findMetaError({
    error: userAssetErr,
    index: new BN(userAssetIndex),
  });

  return userAssetMetaError;
}

beforeAll(async () => {
  await setupApi();
});

beforeEach(async () => {
  const keyring = new Keyring({ type: "sr25519" });
  sudo = new User(keyring, sudoUserName);
  testUser1 = new User(keyring);
  keyring.addPair(testUser1.keyRingPair);
  await testUser1.addMGATokens(sudo);
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
    ExtrinsicResult.ExtrinsicSuccess
  );

  const assetMetadata = await api.query.assetRegistry.metadata(assetId);
  //@ts-ignore
  expect(assetMetadata.value.name.toHuman()).toEqual("TESTUPDT-" + assetId);
});

test("register new asset and then update it by non sudo user, expect to fail", async () => {
  const assetId = await setupUserAssetRegister(sudo, true);

  const userUpdateAsset = await testUser1.updateAsset(assetId);

  expect(getEventResultFromMangataTx(userUpdateAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicFailed
  );

  expect(getEventResultFromMangataTx(userUpdateAsset).data).toContain(
    "RequireSudo"
  );
});

test("register new asset and then update it without the location", async () => {
  const api = getApi();

  const assetId = await setupUserAssetRegister(sudo, true);

  const userUpdateAsset = await sudo.updateAsset(
    assetId,
    {
      xcm: {
        feePerSecond: 53760000000001,
      },
    },
    //@ts-ignore
    api!.createType("Vec<u8>", "0x0100")
  );

  expect(getEventResultFromMangataTx(userUpdateAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess
  );
  const assetMetadata = await api.query.assetRegistry.metadata(assetId);
  //@ts-ignore
  expect(assetMetadata.value.location.toHuman()).toEqual(null);
});

test("register new asset and then update it without fee", async () => {
  const api = getApi();

  const assetId = await setupUserAssetRegister(sudo, true);

  const userUpdateAsset = await sudo.updateAsset(
    assetId,
    //@ts-ignore
    api!.createType("Vec<u8>", "0x0100")
  );

  expect(getEventResultFromMangataTx(userUpdateAsset).state).toEqual(
    ExtrinsicResult.ExtrinsicSuccess
  );

  const assetMetadata = await api.query.assetRegistry.metadata(assetId);
  //@ts-ignore
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

// needs to be moved to sequential, some other parallel test might use the same asset id resulting in "ConflictingAssetId" error instead
test.skip("register asset and then try to register new one with the same location, expect to conflict", async () => {
  const assetId = await setupUserAssetRegister(sudo, true);

  const tempAssetId = await getNextAssetId();

  const userRegisterNewAsset = await sudo.registerAsset(
    tempAssetId,
    tempAssetId,
    {
      V1: {
        parents: 1,
        interior: {
          X3: [
            {
              Parachain: 3210 + assetId.toNumber(),
            },
            {
              GeneralKey: "0x00834",
            },
            {
              PalletInstance: 10,
            },
          ],
        },
      },
    }
  );

  const userAssetMetaError = await findAssetError(userRegisterNewAsset);

  expect(userAssetMetaError.method).toEqual("ConflictingLocation");
});

test("register asset with xyk disabled and try to create a pool, expect to fail", async () => {
  const register = Assets.registerAsset(
    "Disabled Xyk",
    "Disabled Xyk",
    10,
    undefined,
    undefined,
    { operationsDisabled: true }
  );
  const result = await signSendFinalized(register, sudo);
  // assetRegistry.RegisteredAsset [8,{"decimals":10,"name":"0x44697361626c65642058796b","symbol":"0x44697361626c65642058796b","existentialDeposit":0,"location":null,"additional":{"xcm":null,"xyk":{"operationsDisabled":true}}}]
  const assetId = findEventData(
    result,
    "assetRegistry.RegisteredAsset"
  ).assetId;

  await expect(
    signSendFinalized(
      Xyk.createPool(assetId, BN_ONE, BN_ZERO, BN_ONE),
      testUser1
    )
  ).rejects.toEqual(
    expect.objectContaining({
      state: ExtrinsicResult.ExtrinsicFailed,
      data: xykErrors.FunctionNotAvailableForThisToken,
    })
  );
});

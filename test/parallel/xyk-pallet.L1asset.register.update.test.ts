/*
 *
 * @group asset
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { api, getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import {
  getEventErrorFromSudo,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { randomBytes } from "crypto";
import { MangataGenericEvent } from "gasp-sdk";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

//let testUser1: User;
let sudo: User;

let keyring: Keyring;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "ethereum" });

  sudo = getSudoUser();
  keyring.addPair(sudo.keyRingPair);

  await setupApi();
});

test("Asset can be created by a sudo user", async () => {
  let assetId: any;
  const tokenEthereumAddress = "0x" + randomBytes(20).toString("hex");
  await sudo.registerL1Asset(null, tokenEthereumAddress).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    assetId = getAssetId(result);
  });
  const idToL1Asset = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId)),
  );
  expect(idToL1Asset.ethereum).toEqual(tokenEthereumAddress);
});

test("Asset can't be created by a regular user", async () => {
  const [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT),
  );

  await testUser.registerL1Asset(null).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("RequireSudo");
  });
});

test("GIVEN Create one asset with the same address but different chains THEN Operations pass", async () => {
  let assetIdEthereum: any;
  let assetIdArbitrum: any;
  const tokenAddress = "0x" + randomBytes(20).toString("hex");

  await sudo.registerL1Asset(null, tokenAddress, "Ethereum").then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    assetIdEthereum = getAssetId(result);
  });

  await sudo.registerL1Asset(null, tokenAddress, "Arbitrum").then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    assetIdArbitrum = getAssetId(result);
  });

  const idToL1EthereumAsset = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetIdEthereum)),
  );
  const idToL1ArbitrumAsset = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetIdArbitrum)),
  );
  expect(idToL1EthereumAsset.ethereum).toEqual(tokenAddress);
  expect(idToL1ArbitrumAsset.arbitrum).toEqual(tokenAddress);
});

test("GIVEN Create one asset with the same address and same chain THEN Operation fail", async () => {
  const tokenAddress = "0x" + randomBytes(20).toString("hex");

  await sudo.registerL1Asset(null, tokenAddress, "Ethereum").then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await sudo
    .registerL1Asset(null, tokenAddress, "Ethereum")
    .then(async (result) => {
      const sudoEvent = await getEventErrorFromSudo(result);
      expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
      expect(sudoEvent.data).toBe("ConflictingL1Asset");
    });
});

describe("update L1AssetData-", () => {
  let assetId: any;
  let tokenAddressBefore: string;
  let tokenAddressAfter: string;
  let idToL1Asset: any;

  beforeEach(async () => {
    tokenAddressBefore = "0x" + randomBytes(20).toString("hex");
    tokenAddressAfter = "0x" + randomBytes(20).toString("hex");

    await sudo.registerL1Asset(null, tokenAddressBefore).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      assetId = getAssetId(result);
    });

    idToL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId)),
    );
    expect(idToL1Asset.ethereum).toEqual(tokenAddressBefore);
  });

  test("Asset can be updated by a sudo user", async () => {
    await sudo.updateL1Asset(assetId, tokenAddressAfter).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    idToL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId)),
    );
    expect(idToL1Asset.ethereum).toEqual(tokenAddressAfter);
  });

  test("Asset can't be updated by a regular user", async () => {
    const [testUser] = setupUsers();
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser, Assets.DEFAULT_AMOUNT),
    );

    await testUser.updateL1Asset(assetId, tokenAddressAfter).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(eventResponse.data).toEqual("RequireSudo");
    });
  });

  test("GIVEN Update asset so that addresses match but chains are different from existing ones THEN Operation pass", async () => {
    await sudo
      .updateL1Asset(assetId, tokenAddressBefore, "Arbitrum")
      .then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

    idToL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId)),
    );
    expect(idToL1Asset.arbitrum).toEqual(tokenAddressBefore);
  });

  test("GIVEN Update asset so so that addresses & chain matches with some existing ones THEN Operation fail", async () => {
    let assetIdRegistered: any;
    await sudo
      .registerL1Asset(null, tokenAddressAfter, "Arbitrum")
      .then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        assetIdRegistered = getAssetId(result);
      });

    await sudo
      .updateL1Asset(assetId, tokenAddressAfter, "Arbitrum")
      .then(async (result) => {
        const sudoEvent = await getEventErrorFromSudo(result);
        expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
        expect(sudoEvent.data).toBe("ConflictingL1Asset");
      });

    const idToL1AssetRegistered = JSON.parse(
      JSON.stringify(
        await api.query.assetRegistry.idToL1Asset(assetIdRegistered),
      ),
    );
    const idToL1AssetUpdated = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId)),
    );
    expect(idToL1AssetRegistered.arbitrum).toEqual(tokenAddressAfter);
    expect(idToL1AssetUpdated.arbitrum).toEqual(undefined);
  });

  test("GIVEN An asset created by registerAsset AND It has been updated by updateL1Asset THEN It is now accessible through IdToL1Asset", async () => {
    const assetId2 = (
      await Assets.setupUserWithCurrencies(sudo, [new BN(250000)], sudo, true)
    )[0];

    await sudo.registerAsset(assetId2).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    await sudo
      .updateL1Asset(assetId2, tokenAddressAfter, "Ethereum")
      .then(async (result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

    idToL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId2)),
    );
    expect(idToL1Asset.ethereum).toEqual(tokenAddressAfter);
  });
});

test("GIVEN 2 assets which have been created by registerAsset and registerL1Asset THEN Their IDs are consistent", async () => {
  let assetId2: any;
  const assetId1 = (
    await Assets.setupUserWithCurrencies(sudo, [new BN(250000)], sudo, true)
  )[0];

  await sudo.registerAsset(assetId1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  await sudo.registerL1Asset(null).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    assetId2 = getAssetId(result);
  });
  expect(assetId2).bnGt(assetId1);
});

function getAssetId(result: MangataGenericEvent[]) {
  const regAsset = JSON.parse(
    JSON.stringify(
      result.filter((event) => event.method === "RegisteredAsset"),
    ),
  );
  const assetId = regAsset[0].event.data[0];
  return new BN(assetId);
}

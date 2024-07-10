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
  const assetId = await api.query.tokens.nextCurrencyId();
  const tokenEthereumAddress = "0x" + randomBytes(20).toString("hex");
  await sudo.registerL1Asset(assetId, tokenEthereumAddress).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
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

  const assetId = await api.query.tokens.nextCurrencyId();
  await testUser.registerL1Asset(assetId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(eventResponse.data).toEqual("RequireSudo");
  });
});

test("GIVEN Create one asset with the same address but different chains THEN Operations pass", async () => {
  const assetIdEthereum = await api.query.tokens.nextCurrencyId();
  const tokenAddress = "0x" + randomBytes(20).toString("hex");

  await sudo
    .registerL1Asset(assetIdEthereum, tokenAddress, "Ethereum")
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

  const assetIdArbitrum = await api.query.tokens.nextCurrencyId();

  await sudo
    .registerL1Asset(assetIdArbitrum, tokenAddress, "Arbitrum")
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
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
  const assetId1 = await api.query.tokens.nextCurrencyId();
  const tokenAddress = "0x" + randomBytes(20).toString("hex");

  await sudo
    .registerL1Asset(assetId1, tokenAddress, "Ethereum")
    .then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

  const assetId2 = await api.query.tokens.nextCurrencyId();

  await sudo
    .registerL1Asset(assetId2, tokenAddress, "Ethereum")
    .then(async (result) => {
      const sudoEvent = await getEventErrorFromSudo(result);
      expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
      expect(sudoEvent.data).toBe("ConflictingL1Asset");
    });

  const idToL1Asset1 = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId1)),
  );
  const idToL1Asset2 = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(assetId2)),
  );
  expect(idToL1Asset1.ethereum).toEqual(tokenAddress);
  expect(idToL1Asset2).toEqual(null);
});

describe("update L1AssetData-", () => {
  let assetId: any;
  let tokenAddressBefore: string;
  let tokenAddressAfter: string;
  let idToL1Asset: any;

  beforeEach(async () => {
    assetId = await api.query.tokens.nextCurrencyId();
    tokenAddressBefore = "0x" + randomBytes(20).toString("hex");
    tokenAddressAfter = "0x" + randomBytes(20).toString("hex");

    await sudo.registerL1Asset(assetId, tokenAddressBefore).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
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
    const assetId2 = await api.query.tokens.nextCurrencyId();

    await sudo
      .registerL1Asset(assetId2, tokenAddressAfter, "Arbitrum")
      .then((result) => {
        const eventResponse = getEventResultFromMangataTx(result);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      });

    await sudo
      .updateL1Asset(assetId, tokenAddressAfter, "Arbitrum")
      .then(async (result) => {
        const sudoEvent = await getEventErrorFromSudo(result);
        expect(sudoEvent.state).toBe(ExtrinsicResult.ExtrinsicFailed);
        expect(sudoEvent.data).toBe("ConflictingL1Asset");
      });
  });

  test("GIVEN An asset created by registerL1Asset AND It has been updated by updateL1Asset THEN It is now accessible tru IdToL1Asset", async () => {
    const assetId2 = await api.query.tokens.nextCurrencyId();

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
  const assetId1 = await api.query.tokens.nextCurrencyId();

  await sudo.registerAsset(assetId1).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });

  const assetId2 = await api.query.tokens.nextCurrencyId();
  const tokenEthereumAddress = "0x" + randomBytes(20).toString("hex");
  await sudo.registerL1Asset(assetId2, tokenEthereumAddress).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
  expect(assetId2).bnEqual(assetId1.addn(1));
});

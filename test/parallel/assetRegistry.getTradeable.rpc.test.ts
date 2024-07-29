/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi, mangata } from "../../utils/api";
import {
  expectMGAExtrinsicSuDidSuccess,
  filterEventData,
} from "../../utils/eventListeners";
import { alice, setupApi, setupUsers, sudo } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { BN_THOUSAND } from "gasp-sdk";
import { Xyk } from "../../utils/xyk";
import { getLiquidityAssetId } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
let noRegistered: BN;
let empty: BN;
let onlyName: BN;
let nameSymbolDisableTrue: BN;
let nameSymbol: BN;
let nameSymbolDisableFalse: BN;
let liq: BN;

describe("AssetRegistry RPC -", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    setupUsers();
    const events = await Sudo.batchAsSudoFinalized(
      Assets.createTokenWithNoAssetRegistry(alice, Assets.DEFAULT_AMOUNT),
      Assets.registerAsset("", "", 2),
      Assets.registerAsset("onlyName", "", 3),
      Assets.registerAsset("Name&Symbol", "symbol", 5),
      Assets.registerAsset(
        "Name&Symbol&Disabled",
        "symbol3",
        4,
        undefined,
        undefined,
        {
          operationsDisabled: true,
        },
      ),
      Assets.registerAsset(
        "Name&Symbol&Enabled",
        "symbol3",
        6,
        undefined,
        undefined,
        {
          operationsDisabled: false,
        },
      ),
    );
    expectMGAExtrinsicSuDidSuccess(events);
    noRegistered = filterEventData(events, "tokens.Created").map(
      (event) => event[0],
    )[0];
    [
      empty,
      onlyName,
      nameSymbol,
      nameSymbolDisableTrue,
      nameSymbolDisableFalse,
    ] = filterEventData(events, "assetRegistry.RegisteredAsset").map(
      (event) => event.assetId,
    );

    const eventsNewPool = await Sudo.batchAsSudoFinalized(
      Assets.mintNative(sudo),
      Assets.mintToken(nameSymbol, sudo),
      Assets.mintToken(nameSymbolDisableFalse, sudo),
      Xyk.createPool(
        nameSymbol,
        BN_THOUSAND,
        nameSymbolDisableFalse,
        BN_THOUSAND,
      ),
    );
    expectMGAExtrinsicSuDidSuccess(eventsNewPool);
    liq = await getLiquidityAssetId(nameSymbol, nameSymbolDisableFalse);
  });

  test("GIVEN a token that does not exist on the asset registry THEN it won't be returned in RPC", async () => {
    await mangata?.rpc.getTradeableTokens().then((tokens) => {
      expect(tokens.map((x) => x.tokenId)).not.toContain(
        noRegistered.toString(),
      );
    });
  });
  test("GIVEN a token that does exist on the asset registry AND name is empty and symbol is empty and operation disabled is not set THEN it won't be returned in RPC", async () => {
    await mangata?.rpc.getTradeableTokens().then((tokens) => {
      expect(tokens.map((x) => x.tokenId)).not.toContain(empty.toString());
    });
  });
  test("GIVEN a token that does exist on the asset registry AND name is not empty and symbol is empty and operation disabled is not set THEN it won't be returned in RPC", async () => {
    await mangata?.rpc.getTradeableTokens().then((tokens) => {
      expect(tokens.map((x) => x.tokenId)).not.toContain(onlyName.toString());
    });
  });
  test("GIVEN a token that does exist on the asset registry AND name is not empty and symbol is not empty and operation disabled is not set THEN its returned in RPC", async () => {
    await mangata?.rpc.getTradeableTokens().then((tokens) => {
      expect(tokens.map((x) => x.tokenId)).toContain(nameSymbol.toString());
    });
  });
  test("GIVEN a token that does exist on the asset registry AND name is not empty and symbol is not empty and operation disabled is false THEN its returned in RPC", async () => {
    await mangata?.rpc.getTradeableTokens().then((tokens) => {
      expect(tokens.map((x) => x.tokenId)).toContain(
        nameSymbolDisableFalse.toString(),
      );
    });
  });
  test("GIVEN a token that does exist on the asset registry AND name is not empty and symbol is not empty and operation disabled is true THEN its not returned in RPC", async () => {
    await mangata?.rpc.getTradeableTokens().then((tokens) => {
      expect(tokens.map((x) => x.tokenId)).not.toContain(
        nameSymbolDisableTrue.toString(),
      );
    });
  });
  test("GIVEN a token that belongs to a pool WHEN pool is not disabled THEN the token is not filtered", async () => {
    await mangata?.rpc.getTradeableTokens().then((tokens) => {
      expect(tokens.map((x) => x.tokenId)).toContain(liq.toString());
    });
  });
});

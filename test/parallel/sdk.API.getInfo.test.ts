/*
 *
 * @group sdk
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@polkadot/util";
import { api, getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { User } from "../../utils/User";
import { stringToBN } from "../../utils/utils";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { getLiquidityAssetId } from "../../utils/tx";
import { BN_BILLION, BN_ZERO, MangataInstance, PoolWithRatio } from "gasp-sdk";
import { testLog } from "../../utils/Logger";
import { Market } from "../../utils/market";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

let testUser: User;
let testUser1: User;
let sudo: User;
let token1: BN;
let token1Name: string;
let liqId: BN;
let mangata: MangataInstance;
const defaultCurrencyValue = new BN(250000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  // setup users
  sudo = getSudoUser();

  [testUser] = setupUsers();

  await setupApi();

  //this code was added to prevent a token with the number 1 or 3 from being received as a token1. It must be removed after changing SDK
  const tokens = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue, defaultCurrencyValue, defaultCurrencyValue],
    sudo,
  );
  token1 = tokens.pop()!;
  mangata = await getMangataInstance();
  testLog.getLog().info("For SDK getInfo token1 is " + token1.toNumber());
  const assetMetadata = await (
    await mangata.api()
  ).query.assetRegistry.metadata(token1.toNumber());
  testLog
    .getLog()
    .info(
      "For SDK getInfo assetMetadata is " +
        JSON.stringify(assetMetadata.toHuman()),
    );

  token1Name = await (await mangata.api()).query.assetRegistry
    .metadata(token1)
    .then((metadata) => {
      return metadata.value.name.toHuman()!.toString();
    });
  await Sudo.batchAsSudoFinalized(
    Assets.FinalizeTge(),
    Assets.initIssuance(),
    Assets.mintNative(testUser),
    Assets.mintToken(token1, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token1,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token1);

  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));
});

beforeEach(async () => {
  [testUser1] = setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1),
    Assets.mintToken(liqId, testUser1, Assets.DEFAULT_AMOUNT.divn(2)),
  );
});

test("getAmountOfTokensInPool return poolAmount AND in reverse list of token we recived equal result", async () => {
  const poolAmount = await mangata.query.getAmountOfTokensInPool(
    GASP_ASSET_ID.toString(),
    token1.toString(),
  );

  const poolAmountReverse = await mangata.query.getAmountOfTokensInPool(
    token1.toString(),
    GASP_ASSET_ID.toString(),
  );

  expect(poolAmount[0]).bnEqual(Assets.DEFAULT_AMOUNT.divn(2));
  expect(poolAmount[1]).bnEqual(Assets.DEFAULT_AMOUNT.divn(2));
  expect(poolAmountReverse[0]).bnEqual(poolAmount[0]);
  expect(poolAmountReverse[1]).bnEqual(poolAmount[1]);
});

test("check parameters of getInvestedPools function", async () => {
  const userInvestedPool = await mangata.query.getInvestedPools(
    testUser1.keyRingPair.address,
  );

  const firstTokenId = stringToBN(userInvestedPool[0].firstTokenId);
  const secondAssetId = stringToBN(userInvestedPool[0].secondTokenId);

  expect(firstTokenId).bnEqual(GASP_ASSET_ID);
  expect(secondAssetId).bnEqual(token1);
});

test("check parameters of getLiquidityTokenIds function", async () => {
  const tokenIds: BN[] = [];

  const tokenIdsString = await mangata.query.getLiquidityTokenIds();
  const liqIdString = liqId.toString();

  for (let index = 0; index < tokenIdsString.length; index++) {
    if (tokenIdsString[index] === liqIdString) {
      tokenIds.push(stringToBN(tokenIdsString[index]));
    }
  }

  expect(tokenIds[0]).bnEqual(liqId);
});

test("check parameters of getPool function", async () => {
  const liqPool = await mangata.query.getPool(liqId.toString());

  expect(liqPool.firstTokenId).toEqual(GASP_ASSET_ID.toString());
  expect(liqPool.secondTokenId).toEqual(token1.toString());
  expect(liqPool.liquidityTokenId).toEqual(liqId.toString());
});

test("check parameters of getPools function", async () => {
  const liqPools = await mangata.query.getPools();
  const liqPoolsFiltered: PoolWithRatio[] = [];

  for (let index = 0; index < liqPools.length; index++) {
    if (liqPools[index].liquidityTokenId === liqId.toString()) {
      liqPoolsFiltered.push(liqPools[index]);
    }
  }

  expect(liqPoolsFiltered[0].firstTokenId).toEqual(GASP_ASSET_ID.toString());
  expect(liqPoolsFiltered[0].secondTokenId).toEqual(token1.toString());
  expect(liqPoolsFiltered[0].liquidityTokenId).toEqual(liqId.toString());
});

test("check parameters of getTotalIssuance functions", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token2, testUser, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );

  liqId = await getLiquidityAssetId(GASP_ASSET_ID, token2);
  await Sudo.batchAsSudoFinalized(Assets.promotePool(liqId.toNumber(), 20));

  const valueIssuance = await mangata.query.getTotalIssuance(liqId.toString());
  const valueIssuanceAll = await mangata.query.getTotalIssuanceOfTokens();

  expect(valueIssuance).bnEqual(Assets.DEFAULT_AMOUNT.divn(2));
  expect(valueIssuanceAll[liqId.toString()]).bnEqual(
    Assets.DEFAULT_AMOUNT.divn(2),
  );
});

test("check parameters of getChain function", async () => {
  const chainNameSdk = await mangata.rpc.getChain();
  const chainNameRpc = await api.rpc.system.chain();

  expect(chainNameSdk).toContain(chainNameRpc.toString());
});

test("check parameters of getNodeName function", async () => {
  const nodeNameSdk = await mangata.rpc.getNodeName();
  const nodeNameRpc = await api.rpc.system.name();

  expect(nodeNameSdk).toContain(nodeNameRpc.toString());
});

test("check parameters of getNodeVersion function", async () => {
  const nodeVersionSdk = await mangata.rpc.getNodeVersion();
  const nodeVersionRpc = await api.rpc.system.version();

  expect(nodeVersionSdk).toContain(nodeVersionRpc.toString());
});

test("check waitForNewBlock", async () => {
  const blockNumberBefore = stringToBN(await mangata.query.getBlockNumber());

  await mangata.rpc.waitForNewBlock(2);

  const blockNumberAfter = stringToBN(await mangata.query.getBlockNumber());

  expect(blockNumberAfter).bnEqual(blockNumberBefore.add(new BN(1)));
});

test("check calculateMintingFutureRewards", async () => {
  const blocksToPass = new BN(2000);
  const mintingRewards = await mangata.util.calculateMintingFutureRewards(
    liqId.toString(),
    BN_BILLION,
    blocksToPass,
  );
  expect(mintingRewards).bnGt(BN_ZERO);
});

test("check getAssetsInfo", async () => {
  const assetsInfo = await mangata.query.getAssetsInfo();
  const assetsInfoJson = JSON.stringify(assetsInfo);
  testLog
    .getLog()
    .info("For SDK getAssetsInfo assetsInfoJson is " + assetsInfoJson);
  expect(assetsInfo[token1.toNumber()].name).toEqual(token1Name);
});

test("check getLiquidityTokens", async () => {
  const liquidityTokensInfo = await mangata.query.getLiquidityTokens();
  expect(liquidityTokensInfo[liqId.toNumber()].id).toEqual(liqId.toString());
  expect(liquidityTokensInfo[token1.toNumber()]).toEqual(undefined);
});

test("check getOwnedTokens", async () => {
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token1, testUser1, Assets.DEFAULT_AMOUNT),
  );
  const userTokensInfo = await mangata.query.getOwnedTokens(
    testUser1.keyRingPair.address,
  );
  expect(userTokensInfo[GASP_ASSET_ID.toNumber()].balance.free).bnGt(BN_ZERO);
  expect(userTokensInfo[token1.toNumber()].balance.free).bnGt(BN_ZERO);
  expect(userTokensInfo[liqId.toNumber()].balance.free).bnGt(BN_ZERO);
});

test("check getTokenInfo", async () => {
  const tokenInfo = await mangata.query.getTokenInfo(token1.toString());
  const assetsInfoJson = JSON.stringify(tokenInfo);
  testLog
    .getLog()
    .info("For SDK getTokenInfo assetsInfoJson is " + assetsInfoJson);
  expect(tokenInfo.name).toEqual(token1Name);
});

test("sdk - filter deactivated pools on node", async () => {
  const [token2] = await Assets.setupUserWithCurrencies(
    sudo,
    [defaultCurrencyValue],
    sudo,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintToken(token2, testUser1, Assets.DEFAULT_AMOUNT),
    Sudo.sudoAs(
      testUser1,
      Market.createPool(
        GASP_ASSET_ID,
        Assets.DEFAULT_AMOUNT.divn(2),
        token2,
        Assets.DEFAULT_AMOUNT.divn(2),
      ),
    ),
  );
  const liqId2 = await getLiquidityAssetId(GASP_ASSET_ID, token2);
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAs(
      testUser1,
      Market.burnLiquidity(liqId2, Assets.DEFAULT_AMOUNT.divn(2)),
    ),
  );
  const deactivatedPoolId = await getLiquidityAssetId(GASP_ASSET_ID, token2);
  //this list contain only tokens that are active.
  const liquidityAssetsInfo = JSON.parse(
    JSON.stringify(await mangata.rpc.getLiquidityTokensForTrading()),
  );
  expect(liquidityAssetsInfo).not.toContain(deactivatedPoolId.toString());

  //this list contain all liq tokens that are active and inactive from asset registry.
  const poolAssetsInfo = (await mangata.rpc.getTradeableTokens()).filter((id) =>
    id.name.includes("LiquidityPoolToken"),
  );
  const tokenIdsToDeleteSet = new Set(liquidityAssetsInfo);
  //let's remove the active ones from the list => only deactivated ones will remain.
  const deactivatedPoolsAssetsInfo = poolAssetsInfo.filter((id) => {
    return !tokenIdsToDeleteSet.has(id.tokenId);
  });
  const deactivatedPoolsIds: string[] = deactivatedPoolsAssetsInfo.map(
    (token: any) => token.tokenId.toString(),
  );
  expect(deactivatedPoolsIds).toContain(deactivatedPoolId.toString());
});

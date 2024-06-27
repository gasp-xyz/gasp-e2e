/*
 *
 * @group microappsProdPools
 */
import { jest } from "@jest/globals";
import { ApiPromise } from "@polkadot/api";
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import { MangataInstance } from "@mangata-finance/sdk";
import { Node } from "../../utils/Framework/Node/Node";
import { WebDriver } from "selenium-webdriver";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import { LiqPools } from "../../utils/frontend/microapps-pages/LiqPools";
import {
  addExtraLogs,
  comparePoolsLists,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import {
  ARB_ETH_ASSET_ID,
  FIVE_MIN,
  SDK_NOT_EXISTING_FLAG,
} from "../../utils/Constants";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  connectWallet,
  setupPage,
} from "../../utils/frontend/microapps-utils/Handlers";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

const acc_name = "acc_automation";

describe("Microapps UI liq pools tests", () => {
  let sdk: MangataInstance;
  let api: ApiPromise;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    sdk = await getMangataInstance();
    api = getApi();

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("All promoted pools exist in app", async () => {
    const promotedPools = JSON.parse(
      JSON.stringify(
        Object.keys(
          (await api.query.proofOfStake.promotedPoolRewards()).toHuman(),
        ),
      ),
    );
    const promotedPoolsLength = promotedPools.length;
    const promotedPoolsInfo = [];
    for (let i = 0; i < promotedPoolsLength; i++) {
      const promotedPool = await sdk.query.getLiquidityPool(promotedPools[i]);
      if (promotedPool[0] !== SDK_NOT_EXISTING_FLAG) {
        const firstTokenId = await sdk.query.getTokenInfo(promotedPool[0]);
        const secondTokenId = await sdk.query.getTokenInfo(promotedPool[1]);
        const poolData = {
          poolID: promotedPools[i],
          firstToken: firstTokenId.symbol,
          secondToken: secondTokenId.symbol,
        };
        promotedPoolsInfo.push(poolData);
      }
    }

    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();
    const liquidityPools = await new LiqPools(driver);
    const fePoolsList = await liquidityPools.getPoolsList();
    await comparePoolsLists(fePoolsList, promotedPoolsInfo, liquidityPools);
  });

  it("All liquidity pools exist in app", async () => {
    const liquidityAssets = await api.query.xyk.liquidityAssets.entries();
    const liquidityAssetsLength = liquidityAssets.length;
    const liquidityPoolsInfo = [];
    for (let i = 0; i < liquidityAssetsLength; i++) {
      const liquidityAsset = JSON.parse(
        JSON.stringify(liquidityAssets[i][1].value),
      );
      const liquidityPool = await sdk.query.getLiquidityPool(liquidityAsset);
      if (
        liquidityPool[1] !== ARB_ETH_ASSET_ID.toString() &&
        liquidityPool[0] !== SDK_NOT_EXISTING_FLAG
      ) {
        const firstTokenInfo = await sdk.query.getTokenInfo(liquidityPool[0]);
        const secondTokenInfo = await sdk.query.getTokenInfo(liquidityPool[1]);
        const poolData = {
          poolID: liquidityAsset,
          firstToken: firstTokenInfo.symbol,
          secondToken: secondTokenInfo.symbol,
        };
        liquidityPoolsInfo.push(poolData);
      }
    }

    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();
    const liquidityPools = await new LiqPools(driver);
    await liquidityPools.clickAllPoolsTab();
    const fePoolsList = await liquidityPools.getPoolsList();
    await comparePoolsLists(fePoolsList, liquidityPoolsInfo, liquidityPools);
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});

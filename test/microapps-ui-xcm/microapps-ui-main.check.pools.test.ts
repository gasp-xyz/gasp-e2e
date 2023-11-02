/*
 *
 * @group microappsXCM
 */
import { jest } from "@jest/globals";
import { ApiPromise, Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { getApi, initApi, getMangataInstance } from "../../utils/api";
import {
  BN_TEN_THOUSAND,
  BN_THOUSAND,
  MangataInstance,
} from "@mangata-finance/sdk";
import { Node } from "../../utils/Framework/Node/Node";
import { By, WebDriver } from "selenium-webdriver";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import { LiqPools } from "../../utils/frontend/microapps-pages/LiqPools";
import {
  addExtraLogs,
  importPolkadotExtension,
  waitForElementVisible,
} from "../../utils/frontend/utils/Helper";
import { FIVE_MIN, KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { connectVertical } from "@acala-network/chopsticks";
import { devTestingPairs } from "../../utils/setup";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { AssetId } from "../../utils/ChainSpecs";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { AssetWallet, User } from "../../utils/User";
import {
  connectWallet,
  setupPage,
} from "../../utils/frontend/microapps-utils/Handlers";
import "jest-extended";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";

describe("Microapps UI liq pools tests", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;
  let sdk: MangataInstance;
  let api: ApiPromise;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama({ localPort: 9944 });
    mangata = await XcmNetworks.mangata({ localPort: 9946 });
    await connectVertical(kusama.chain, mangata.chain);
    alice = devTestingPairs().alice;
    StashServiceMockSingleton.getInstance().startMock();

    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    sdk = await getMangataInstance();
    api = getApi();

    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[userAddress, { token: 4 }], { free: 10 * 1e12 }],
          [[userAddress, { token: 7 }], { free: 10 * 1e10 }],
          [
            [userAddress, { token: 26 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_TEN_THOUSAND).toString() },
          ],
          [[alice.address, { token: 4 }], { free: 10 * 1e12 }],
          [
            [alice.address, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
        ],
      },
      Sudo: {
        Key: userAddress,
      },
    });

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(
      keyring,
      getEnvironmentRequiredVars().mnemonicPolkadot,
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("All promoted pools exist in app", async () => {
    const promotedPoolsRewards =
      await api.query.proofOfStake.promotedPoolRewards();
    const promotedPools = JSON.parse(
      JSON.stringify(Object.keys(promotedPoolsRewards.toHuman())),
    );
    const promotedPoolsLength = promotedPools.length;
    const promotedPoolsInfo = [];
    for (let i = 0; i < promotedPoolsLength; i++) {
      const poolName = await sdk.query.getLiquidityPool(promotedPools[i]);
      const firstTokenId = await sdk.query.getTokenInfo(poolName[0]);
      const secondTokenId = await sdk.query.getTokenInfo(poolName[1]);
      const poolData = {
        poolID: promotedPools[i],
        firstToken: firstTokenId.symbol,
        secondToken: secondTokenId.symbol,
      };
      promotedPoolsInfo.push(poolData);
    }

    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();
    const poolsList = await new LiqPools(driver);
    await comparePoolsLists(promotedPoolsInfo, poolsList);
  });

  it("All liquidity pools exist in app", async () => {
    const liquidityAssets = await api.query.xyk.liquidityAssets.entries();
    const liquidityPoolsLength = liquidityAssets.length;
    const liquidityPoolsInfo = [];
    for (let i = 0; i < liquidityPoolsLength; i++) {
      const liquidityAsset = JSON.parse(
        JSON.stringify(liquidityAssets[i][1].value),
      );
      const poolName = await sdk.query.getLiquidityPool(liquidityAsset);
      if (poolName[1] !== "2") {
        const firstTokenInfo = await sdk.query.getTokenInfo(poolName[0]);
        const secondTokenInfo = await sdk.query.getTokenInfo(poolName[1]);
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
    const poolsList = await new LiqPools(driver);
    await poolsList.clickAllPoolsTab();
    await comparePoolsLists(liquidityPoolsInfo, poolsList);
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    StashServiceMockSingleton.getInstance().stopServer();
    await kusama.teardown();
    await mangata.teardown();
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});

async function comparePoolsLists(bePoolsInfo: any, poolsList: LiqPools) {
  await waitForElementVisible(
    poolsList.driver,
    "//*[@class='focus:outline-0 group']",
    5000,
  );
  const fePoolsInfo = await poolsList.driver.findElements(
    By.xpath("//*[@class='focus:outline-0 group']"),
  );
  const bePoolsInfoLength = bePoolsInfo.length;
  const fePoolsNumber = fePoolsInfo.length;
  const fePoolsList = [];
  for (let i = 0; i < fePoolsNumber; i++) {
    const dataTestId = await fePoolsInfo[i].getAttribute("data-testid");
    fePoolsList.push(dataTestId);
  }

  const bePoolsList = [];
  for (let i = 0; i < bePoolsInfoLength; i++) {
    const isPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + bePoolsInfo[i].firstToken + "-" + bePoolsInfo[i].secondToken,
    );
    if (isPoolVisible) {
      bePoolsList.push(
        "pool-item" +
          "-" +
          bePoolsInfo[i].firstToken +
          "-" +
          bePoolsInfo[i].secondToken,
      );
    } else {
      bePoolsList.push(
        "pool-item" +
          "-" +
          bePoolsInfo[i].secondToken +
          "-" +
          bePoolsInfo[i].firstToken,
      );
    }
  }
  expect(bePoolsList).toIncludeSameMembers(fePoolsList);
}

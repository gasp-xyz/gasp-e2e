/*
 *
 * @group microappsWallet
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  FIVE_MIN,
  KSM_ASSET_ID,
  MGA_ASSET_ID,
} from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/microapps-utils/Handlers";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";
import { connectVertical } from "@acala-network/chopsticks";
import { BN_TEN_THOUSAND, BN_THOUSAND } from "@mangata-finance/sdk";
import { AssetId } from "../../utils/ChainSpecs";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { devTestingPairs } from "../../utils/setup";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { KeyringPair } from "@polkadot/keyring/types";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5CfLmpjCJu41g3cpZVoiH7MSrSppgVVVC3xq23iy9dZrW2HR";
const KSM_ASSET_NAME = "KSM";
const MGX_ASSET_NAME = "MGX";

describe("Microapps UI wallet tests", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;
  let alice: KeyringPair;

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

    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[userAddress, { token: 4 }], { free: 10 * 1e12 }],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_TEN_THOUSAND).toString() },
          ],
          [
            [userAddress, { token: 5 }],
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

  test("User can see his tokens and amounts", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const isKSM = await walletWrapper.isMyTokensRowDisplayed(KSM_ASSET_NAME);
    expect(isKSM).toBeTruthy();
    const isMGX = await walletWrapper.isMyTokensRowDisplayed(MGX_ASSET_NAME);
    expect(isMGX).toBeTruthy();

    const mgxAmount = await walletWrapper.getMyTokensRowAmount(MGX_ASSET_NAME);
    expect(parseFloat(mgxAmount)).toBeGreaterThan(0);

    const ksmAmount = await walletWrapper.getMyTokensRowAmount(KSM_ASSET_NAME);
    expect(parseFloat(ksmAmount)).toBeGreaterThan(0);
  });

  test("User can see his pool positions", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.pickMyPositions();
    const POOL_NAME = "MGX - KSM";
    const isTurMgx = await walletWrapper.isMyPositionsRowDisplayed(POOL_NAME);
    expect(isTurMgx).toBeTruthy();
  });

  test("User can see his tokens fiat value", async () => {
    await setupPageWithState(driver, acc_name);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    const isMGX = await walletWrapper.isMyTokensRowDisplayed(MGX_ASSET_NAME);
    expect(isMGX).toBeTruthy();
    const isKSM = await walletWrapper.isMyTokensRowDisplayed(KSM_ASSET_NAME);
    expect(isKSM).toBeTruthy();

    const mgxValue =
      await walletWrapper.getMyTokensRowFiatValue(MGX_ASSET_NAME);
    expect(parseFloat(mgxValue)).toBeGreaterThan(0);

    const ksmValue =
      await walletWrapper.getMyTokensRowFiatValue(KSM_ASSET_NAME);
    expect(parseFloat(ksmValue)).toBeGreaterThan(0);
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

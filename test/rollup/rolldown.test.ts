/*
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { ApiPromise, Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { waitForNBlocks } from "../../utils/utils";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { EthUser } from "../../utils/EthUser";
import {
  getLastProcessedRequestNumber,
  rolldownDeposit,
  rolldownWithdraw,
} from "../../utils/rolldown";
import { signTx } from "@mangata-finance/sdk";
import { signTxMetamask } from "../../utils/metamask";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("Tests with rolldown functions:", () => {
  let sdkApi: ApiPromise;
  let keyring: Keyring;
  let sudo: User;
  let testEthUser: EthUser;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    setupUsers();
    const mangata = await getMangataInstance();
    sdkApi = await mangata.api();
    keyring = new Keyring({ type: "ecdsa" });
    sudo = getSudoUser();

    await setupApi();
    await sudo.addMGATokens(sudo);
  });

  beforeEach(async () => {
    testEthUser = new EthUser(keyring);
  });

  test.skip("Deposit token using rolldown and cancel it", async () => {
    await testEthUser.addMGATokens(sudo);
    const lastProcessRequest = await getLastProcessedRequestNumber();
    await signTx(
      sdkApi,
      await rolldownDeposit(
        lastProcessRequest + 1,
        testEthUser.ethAddress,
        1000,
      ),
      sudo.keyRingPair,
    );
  });

  test.skip("Deposit token using rolldown and then withdraw a part", async () => {
    await testEthUser.addMGATokens(sudo);
    const lastProcessRequest = await getLastProcessedRequestNumber();
    await signTx(
      sdkApi,
      await rolldownDeposit(
        lastProcessRequest + 1,
        testEthUser.ethAddress,
        1000,
      ),
      sudo.keyRingPair,
    );

    await waitForNBlocks(4);

    await signTxMetamask(
      await rolldownWithdraw(testEthUser, 100),
      testEthUser.ethAddress,
      testEthUser.privateKey,
    );
  });

  test("brum", async () => {
    console.log("brum");
  });
});

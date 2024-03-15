/*
 *
 * @group rolldown
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { ApiPromise, Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { setupApi } from "../../utils/setup";
import { EthUser } from "../../utils/EthUser";
import { rolldownDeposit } from "../../utils/rolldown";
import { signTx } from "@mangata-finance/sdk";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("Tests with rolldown functions:", () => {
  const { sudo: sudoUserName } = getEnvironmentRequiredVars();

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

    const mangata = await getMangataInstance();
    sdkApi = await mangata.api();
    keyring = new Keyring({ type: "sr25519" });
    sudo = new User(keyring, sudoUserName);

    await setupApi();
    await sudo.addMGATokens(sudo);
  });

  beforeEach(async () => {
    testEthUser = new EthUser(keyring);
  });

  test("Deposit token using rolldown", async () => {
    await signTx(
      sdkApi,
      await rolldownDeposit(0, 1, 1, testEthUser.ethAddress, 123),
      sudo.keyRingPair,
    );
  });
});

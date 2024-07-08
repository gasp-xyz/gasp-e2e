/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { api, getSudoUser, setupApi } from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";

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
  // setup users
  const assetId = await api.query.tokens.nextCurrencyId();
  await sudo.registerL1Asset(assetId).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  });
});

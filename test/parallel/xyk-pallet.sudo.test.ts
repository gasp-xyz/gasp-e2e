/*
 *
 * @group xyk
 * @group sudo
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { getUserAssets, getSudoKey } from "../../utils/tx";
import { BN } from "@polkadot/util";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { validateTransactionSucessful } from "../../utils/validators";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import {
  getEventResultFromMangataTx,
  sudoIssueAsset,
} from "../../utils/txHandler";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

let testUser: User;
let keyring: Keyring;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
});

beforeEach(async () => {
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  testUser = new User(keyring);
  const sudo = new User(keyring, sudoUserName);
  // add users to pair.
  keyring.addPair(testUser.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
});

test("xyk-pallet - Sudo tests: Sudo Issue an asset", async () => {
  //setup
  const sudoKey = await getSudoKey();
  const sudoPair = keyring.getPair(sudoKey.toString());
  const tokensAmount = 220000;
  //act

  let assetId = new BN(0);
  await sudoIssueAsset(
    sudoPair,
    new BN(tokensAmount),
    testUser.keyRingPair.address,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "tokens",
      "Created",
      testUser.keyRingPair.address,
    ]);
    assetId = new BN(eventResponse.data[0].split(",").join(""));
    validateTransactionSucessful(eventResponse, tokensAmount, testUser);
  });

  // get the new  assetId from the response.

  testLog
    .getLog()
    .info("Sudo: issued asset " + assetId + " to " + testUser.name);

  //validate
  const userAssets = await getUserAssets(testUser.keyRingPair.address, [
    assetId,
  ]);
  expect(userAssets.map((asset) => asset.free)).collectionBnEqual([
    new BN(tokensAmount),
  ]);
});

test("xyk-pallet - Sudo tests: Sudo Issue two  different assets to the same account", async () => {
  const sudoKey = await getSudoKey();
  const sudoPair = keyring.getPair(sudoKey.toString());
  const tokensFirstAmount = 220000;
  //act

  let assetId = new BN(0);
  await sudoIssueAsset(
    sudoPair,
    new BN(tokensFirstAmount),
    testUser.keyRingPair.address,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "tokens",
      "Created",
      testUser.keyRingPair.address,
    ]);
    assetId = new BN(eventResponse.data[0].split(",").join(""));
    validateTransactionSucessful(eventResponse, tokensFirstAmount, testUser);
  });
  testLog
    .getLog()
    .info("Sudo: asset issued " + assetId + " to " + testUser.name);

  // act2 : send the second asset issue.
  const tokensSecondAmount = 120000;
  let secondAssetId = new BN(0);
  await sudoIssueAsset(
    sudoPair,
    new BN(tokensSecondAmount),
    testUser.keyRingPair.address,
  ).then((result) => {
    const eventResponse = getEventResultFromMangataTx(result, [
      "tokens",
      "Created",
      testUser.keyRingPair.address,
    ]);
    secondAssetId = new BN(eventResponse.data[0].split(",").join(""));
    validateTransactionSucessful(eventResponse, tokensSecondAmount, testUser);
  });
  // validate.
  const userAssets = await getUserAssets(testUser.keyRingPair.address, [
    assetId,
    secondAssetId,
  ]);

  expect(parseInt(userAssets[0].free.toString())).toEqual(tokensFirstAmount);
  expect(parseInt(userAssets[1].free.toString())).toEqual(tokensSecondAmount);
});

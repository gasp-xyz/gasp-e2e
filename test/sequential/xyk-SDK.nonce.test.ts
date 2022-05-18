/*
 *
 * @group xyk
 * @group errors
 * @group sequential
 * @group sdk
 */
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { Mangata } from "mangata-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { waitNewBlock } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { createPoolIfMissing } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
const { sudo: sudoUserName } = getEnvironmentRequiredVars();

let testUser: User;
let firstCurrency: BN;
let sudo: User;
let keyring: Keyring;
let mangata: Mangata;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await getApi();
  mangata = await getMangataInstance();

  keyring = new Keyring({ type: "sr25519" });
  // setup users
  testUser = new User(keyring);
  sudo = new User(keyring, sudoUserName);
  // add users to pair.
  keyring.addPair(testUser.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
});

describe("SDK test - Nonce tests - user", () => {
  beforeAll(async () => {
    await testUser.addMGATokens(sudo);
    //add two curerncies and balance to testUser:
    [firstCurrency] = await Assets.setupUserWithCurrencies(
      testUser,
      [new BN(10000000000)],
      sudo
    );
    await createPoolIfMissing(
      sudo,
      new BN(100000).toString(),
      MGA_ASSET_ID,
      firstCurrency
    );
  });

  test("SDK- Nonce management - user", async () => {
    const userNonce = [];
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    const event = await mangata.sellAsset(
      testUser.keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      new BN(1000),
      new BN(0)
    );
    const eventResult = getEventResultFromMangataTx(event);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    expect(userNonce[1]).bnEqual(userNonce[0].add(new BN(1)));
  });
  test("SDK- Nonce management - user - parallel", async () => {
    const userNonce = [];
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    const promises = [];
    for (let index = 0; index < 10; index++) {
      promises.push(
        mangata.sellAsset(
          testUser.keyRingPair,
          firstCurrency.toString(),
          MGA_ASSET_ID.toString(),
          new BN(1000),
          new BN(0)
        )
      );
    }
    await Promise.all(promises);
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThan(
      parseFloat(userNonce[0].toString()) + 9
    );
  });
  test("SDK- Nonce management - user - future Tx-", async () => {
    const userNonce = [];
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    const promises = [];
    const maxFutureNonce = userNonce[0].toNumber() + 3;
    for (
      let index = maxFutureNonce;
      index >= userNonce[0].toNumber();
      index--
    ) {
      promises.push(
        mangata.sellAsset(
          testUser.keyRingPair,
          firstCurrency.toString(),
          MGA_ASSET_ID.toString(),
          new BN(1000 + index),
          new BN(0),
          {
            nonce: new BN(index),
          }
        )
      );
      await waitNewBlock();
    }
    const promisesEvents = await await Promise.all(promises);
    promisesEvents.forEach((events) => {
      const result = getEventResultFromMangataTx(events);
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThanOrEqual(
      parseFloat(userNonce[0].toString()) + 2
    );
  });
  test("SDK- Nonce management - Extrinsic failed", async () => {
    const userNonce = [];
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));

    //pool does not exist.
    const MAX_INT = 4294967295;
    const event = await mangata.sellAsset(
      testUser.keyRingPair,
      (MAX_INT - 1).toString(),
      (MAX_INT - 2).toString(),
      new BN(1000),
      new BN(1)
    );
    const eventResult = getEventResultFromMangataTx(event);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThan(
      parseFloat(userNonce[0].toString())
    );
  });
  test("SDK- Nonce management - Using custom nonce", async () => {
    const userNonce = [];
    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    const events = await mangata.sellAsset(
      testUser.keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      new BN(1000),
      new BN(0),
      {
        nonce: userNonce[0],
      }
    );
    let eventResult = getEventResultFromMangataTx(events);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    //perform an operation without custom nonce.
    const events2 = await mangata.sellAsset(
      testUser.keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      new BN(1000),
      new BN(0)
    );
    eventResult = getEventResultFromMangataTx(events2);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThan(
      parseFloat(userNonce[0].toString())
    );
  });
  test.skip("[BUG?] SDK- Nonce management - Transaction outdated", async () => {
    const userNonce = [];
    // perform an operation to have nonce > 0.
    await mangata.sellAsset(
      testUser.keyRingPair,
      firstCurrency.toString(),
      MGA_ASSET_ID.toString(),
      new BN(1000),
      new BN(0)
    );

    userNonce.push(await mangata.getNonce(testUser.keyRingPair.address));
    let exception = false;
    await expect(
      mangata
        .sellAsset(
          testUser.keyRingPair,
          firstCurrency.toString(),
          MGA_ASSET_ID.toString(),
          new BN(1000),
          new BN(0),
          {
            nonce: new BN(0),
          }
        )
        .catch((reason) => {
          exception = true;
          throw new Error(reason);
        })
    ).rejects.toThrow("1010: Invalid Transaction: Transaction is outdated");
    expect(exception).toBeTruthy();
  });
});

describe("SDK test - Nonce tests - Errors", () => {
  test.skip("[BUG?] SDK- Nonce management - RPC Failure - Not enough balance", async () => {
    const testUser2 = new User(keyring);
    keyring.addPair(testUser2.keyRingPair);
    const userNonce = [];
    const sudoNonce = [];
    userNonce.push(await mangata.getNonce(testUser2.keyRingPair.address));
    sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));

    //pool does not exist.
    const MAX_INT = 4294967295;
    let exception = false;
    await expect(
      mangata
        .mintLiquidity(
          testUser.keyRingPair,
          (MAX_INT - 1).toString(),
          (MAX_INT - 2).toString(),
          new BN(1000),
          new BN(MAX_INT)
        )
        .catch((reason) => {
          exception = true;
          throw new Error(reason);
        })
    ).rejects.toThrow(
      "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low"
    );
    expect(exception).toBeTruthy();

    userNonce.push(await mangata.getNonce(testUser2.keyRingPair.address));
    sudoNonce.push(await mangata.getNonce(sudo.keyRingPair.address));
    expect(sudoNonce[1]).bnEqual(sudoNonce[0]);
    expect(userNonce[1]).bnEqual(sudoNonce[0]);
  });
});

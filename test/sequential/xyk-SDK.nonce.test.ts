/*
 *
 * @group sdk
 */
import { jest } from "@jest/globals";
import { getApi, getMangataInstance, initApi } from "../../utils/api";
import { BN } from "@polkadot/util";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import { MangataInstance, toBN } from "@mangata-finance/sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { waitNewBlock } from "../../utils/eventListeners";
import { Assets } from "../../utils/Assets";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { Node } from "../../utils/Framework/Node/Node";
import { Sudo } from "../../utils/sudo";
import { Xyk } from "../../utils/xyk";
import { setupApi, setupUsers } from "../../utils/setup";
import { sellAsset, mintLiquidity } from "../../utils/tx";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

let testUser: User;
let firstCurrency: BN;
let sudo: SudoUser;
let keyring: Keyring;
let mangata: MangataInstance;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await getApi();
  mangata = await getMangataInstance();
  await setupApi();
  await setupUsers();
  keyring = new Keyring({ type: "sr25519" });
  // setup users
  testUser = new User(keyring);
  const node = new Node(getEnvironmentRequiredVars().chainUri);
  await node.connect();
  sudo = new SudoUser(keyring, node);

  // add users to pair.
  keyring.addPair(testUser.keyRingPair);
  keyring.addPair(sudo.keyRingPair);
});

describe.skip("SDK test - Nonce tests - user", () => {
  beforeAll(async () => {
    await testUser.addMGATokens(sudo, toBN("1", 22));
    //add two curerncies and balance to testUser:
    [firstCurrency] = await Assets.setupUserWithCurrencies(
      testUser,
      [new BN(10000000000)],
      sudo,
    );
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(firstCurrency, testUser, new BN(10000000000)),
      Assets.mintNative(testUser),
      Sudo.sudoAs(
        sudo,
        Xyk.createPool(
          MGA_ASSET_ID,
          new BN(100000),
          firstCurrency,
          new BN(100000),
        ),
      ),
    );
  });

  test("SDK- Nonce management - user", async () => {
    const userNonce = [];
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    const event = await sellAsset(
      testUser.keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      new BN(1000),
      new BN(0),
    );
    const eventResult = getEventResultFromMangataTx(event);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    expect(userNonce[1]).bnEqual(userNonce[0].add(new BN(1)));
  });
  test("SDK- Nonce management - user - parallel", async () => {
    const userNonce = [];
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    const promises = [];
    for (let index = 0; index < 10; index++) {
      promises.push(
        sellAsset(
          testUser.keyRingPair,
          firstCurrency,
          MGA_ASSET_ID,
          new BN(1000),
          new BN(0),
          { nonce: userNonce[0].addn(index) },
        ),
      );
    }
    await Promise.all(promises);
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThan(
      parseFloat(userNonce[0].toString()) + 9,
    );
  });
  test("SDK- Nonce management - user - future Tx-", async () => {
    const userNonce = [];
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    const promises = [];
    const maxFutureNonce = userNonce[0].toNumber() + 3;
    for (
      let index = maxFutureNonce;
      index >= userNonce[0].toNumber();
      index--
    ) {
      promises.push(
        sellAsset(
          testUser.keyRingPair,
          firstCurrency,
          MGA_ASSET_ID,
          new BN(1000 + index),
          new BN(0),
          {
            nonce: new BN(index),
          },
        ),
      );
      await waitNewBlock();
    }
    const promisesEvents = await Promise.all(promises);
    promisesEvents.forEach((events) => {
      const result = getEventResultFromMangataTx(events);
      expect(result.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThanOrEqual(
      parseFloat(userNonce[0].toString()) + 2,
    );
  });
  test("SDK- Nonce management - Extrinsic failed", async () => {
    const userNonce = [];
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));

    //pool does not exist.
    const MAX_INT = 4294967295;
    const event = await sellAsset(
      testUser.keyRingPair,
      new BN(MAX_INT - 1),
      new BN(MAX_INT - 2),
      new BN(1000),
      new BN(1),
    );
    const eventResult = getEventResultFromMangataTx(event);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThan(
      parseFloat(userNonce[0].toString()),
    );
  });
  test("SDK- Nonce management - Using custom nonce", async () => {
    const userNonce = [];
    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    const events = await sellAsset(
      testUser.keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      new BN(1000),
      new BN(0),
      {
        nonce: userNonce[0],
      },
    );
    let eventResult = getEventResultFromMangataTx(events);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    //perform an operation without custom nonce.
    const events2 = await sellAsset(
      testUser.keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      new BN(1000),
      new BN(0),
    );
    eventResult = getEventResultFromMangataTx(events2);
    expect(eventResult.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    expect(parseFloat(userNonce[1].toString())).toBeGreaterThan(
      parseFloat(userNonce[0].toString()),
    );
  });
  test.skip("[BUG?] SDK- Nonce management - Transaction outdated", async () => {
    const userNonce = [];
    // perform an operation to have nonce > 0.
    await sellAsset(
      testUser.keyRingPair,
      firstCurrency,
      MGA_ASSET_ID,
      new BN(1000),
      new BN(0),
    );

    userNonce.push(await mangata.query.getNonce(testUser.keyRingPair.address));
    let exception = false;
    await expect(
      sellAsset(
        testUser.keyRingPair,
        firstCurrency,
        MGA_ASSET_ID,
        new BN(1000),
        new BN(0),
        {
          nonce: new BN(0),
        },
      ).catch((reason) => {
        exception = true;
        throw new Error(reason);
      }),
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
    userNonce.push(await mangata.query.getNonce(testUser2.keyRingPair.address));
    sudoNonce.push(await mangata.query.getNonce(sudo.keyRingPair.address));

    //pool does not exist.
    const MAX_INT = 4294967295;
    let exception = false;
    await expect(
      mintLiquidity(
        testUser.keyRingPair,
        new BN(MAX_INT - 1),
        new BN(MAX_INT - 2),
        new BN(1000),
        new BN(MAX_INT),
      ).catch((reason) => {
        exception = true;
        throw new Error(reason);
      }),
    ).rejects.toThrow(
      "1010: Invalid Transaction: Inability to pay some fees , e.g. account balance too low",
    );
    expect(exception).toBeTruthy();

    userNonce.push(await mangata.query.getNonce(testUser2.keyRingPair.address));
    sudoNonce.push(await mangata.query.getNonce(sudo.keyRingPair.address));
    expect(sudoNonce[1]).bnEqual(sudoNonce[0]);
    expect(userNonce[1]).bnEqual(sudoNonce[0]);
  });
});

/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { getApi, initApi } from "../../utils/api";
import {
  scheduleBootstrap,
  provisionBootstrap,
  provisionVestedBootstrap,
  finalizeBootstrap,
  getLiquidityAssetId,
  claimAndActivateBootstrap,
  promotePool,
  vestingTransfer,
} from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForNBlocks,
  getBlockNumber,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, toBN } from "@mangata-finance/sdk";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let bootstrapPhase: any;
let bootstrapCurrency: any;
let bootstrapPool: any;
let bootstrapUser1Liquidity: any;
let bootstrapUser2Liquidity: any;
let bootstrapExpectedUserLiquidity: BN;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 15;
const bootstrapPeriod = 30;
const bootstrapAmount = new BN(10000000000);

async function bootstrapRunning(
  promotedPool: boolean,
  vestedProvision: boolean
) {
  const api = getApi();
  if (vestedProvision === true) {
    const bootstrapBlockNumber = (await getBlockNumber()) + 10;
    await sudo.addMGATokens(sudo);
    const vestingUser = await vestingTransfer(
      sudo,
      MGA_ASSET_ID,
      sudo,
      testUser1,
      bootstrapBlockNumber
    );
    eventResponse = getEventResultFromMangataTx(vestingUser);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }
  await testUser1.addMGATokens(sudo);
  await sudo.mint(bootstrapCurrency, testUser1, toBN("1", 20));
  await testUser2.addMGATokens(sudo);
  await sudo.mint(bootstrapCurrency, testUser2, toBN("1", 20));

  const sudoBootstrap = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriod,
    bootstrapPeriod
  );
  eventResponse = getEventResultFromMangataTx(sudoBootstrap);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(waitingPeriod);

  bootstrapPhase = await api.query.bootstrap.phase();
  expect(bootstrapPhase.toString()).toEqual("Public");

  // provision from User1
  const provisionBTUser1 = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  if (vestedProvision === true) {
    const provisionMGAUser1 = await provisionVestedBootstrap(
      testUser1,
      MGA_ASSET_ID,
      bootstrapAmount
    );
    eventResponse = getEventResultFromMangataTx(provisionMGAUser1);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  } else {
    const provisionMGAUser1 = await provisionBootstrap(
      testUser1,
      MGA_ASSET_ID,
      bootstrapAmount
    );
    eventResponse = getEventResultFromMangataTx(provisionMGAUser1);
    expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  // provision from User2
  const provisionBTUser2 = await provisionBootstrap(
    testUser2,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionBTUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  const provisionMGAUser2 = await provisionBootstrap(
    testUser2,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionMGAUser2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForNBlocks(bootstrapPeriod);

  const bootstrapAmountPool = bootstrapAmount.muln(2);
  bootstrapPool = await api.query.xyk.pools([MGA_ASSET_ID, bootstrapCurrency]);
  expect(bootstrapPool[0]).bnEqual(bootstrapAmountPool);
  expect(bootstrapPool[1]).bnEqual(bootstrapAmountPool);
  const bootstrapExpectedUserLiquidity = new BN(
    bootstrapPool[0].add(bootstrapPool[1]) / 4
  );

  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  if (promotedPool === true) {
    const promotingPool = await promotePool(sudo.keyRingPair, liquidityID);
    expect(promotingPool.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
  }

  const claimAndActivate1 = await claimAndActivateBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimAndActivate1);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const claimAndActivate2 = await claimAndActivateBootstrap(testUser2);
  eventResponse = getEventResultFromMangataTx(claimAndActivate2);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  // finalaze bootstrap
  const bootstrapFinalize = await finalizeBootstrap(sudo);
  eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const bootstrapUser1Liquidity = await api.query.tokens.accounts(
    testUser1.keyRingPair.address,
    liquidityID
  );

  const bootstrapUser2Liquidity = await api.query.tokens.accounts(
    testUser2.keyRingPair.address,
    liquidityID
  );

  return {
    bootstrapUser1Liquidity: bootstrapUser1Liquidity,
    bootstrapUser2Liquidity: bootstrapUser2Liquidity,
    bootstrapExpectedUserLiquidity: bootstrapExpectedUserLiquidity,
  };
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);
  keyring.addPair(sudo.keyRingPair);

  await sudo.addMGATokens(sudo);
});

describe.each`
  promoting | vesting
  ${true}   | ${false}
  ${false}  | ${false}
  ${false}  | ${true}
`(
  "bootstrap - checking bootstrapped pool in different situations",
  ({ promoting, vesting }) => {
    beforeEach(async () => {
      const api = getApi();
      bootstrapPhase = await api.query.bootstrap.phase();
      if (bootstrapPhase.toString() === "Finished") {
        const bootstrapFinalize = await finalizeBootstrap(sudo);
        eventResponse = getEventResultFromMangataTx(bootstrapFinalize);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
      }

      bootstrapPhase = await api.query.bootstrap.phase();
      expect(bootstrapPhase.toString()).toEqual("BeforeStart");

      bootstrapCurrency = await Assets.issueAssetToUser(
        sudo,
        toBN("1", 20),
        sudo
      );

      testUser1 = new User(keyring);
      keyring.addPair(testUser1.keyRingPair);

      testUser2 = new User(keyring);
      keyring.addPair(testUser2.keyRingPair);
    });

    test(
      "bootstrap - checking claiming and activating rewards. Promoting pool is " +
        promoting.toString() +
        ", vesting MGA token for User1 is " +
        vesting.toString(),
      async () => {
        const bootstrapFunction = await bootstrapRunning(promoting, vesting);
        bootstrapUser1Liquidity = bootstrapFunction.bootstrapUser1Liquidity;
        bootstrapUser2Liquidity = bootstrapFunction.bootstrapUser2Liquidity;
        bootstrapExpectedUserLiquidity =
          bootstrapFunction.bootstrapExpectedUserLiquidity;
        if (promoting === true) {
          expect(bootstrapUser1Liquidity.free).bnEqual(new BN(0));
          expect(bootstrapUser1Liquidity.reserved).bnEqual(
            bootstrapExpectedUserLiquidity
          );
          expect(bootstrapUser2Liquidity.free).bnEqual(new BN(0));
          expect(bootstrapUser2Liquidity.reserved).bnEqual(
            bootstrapExpectedUserLiquidity
          );
        } else {
          expect(bootstrapUser1Liquidity.reserved).bnEqual(new BN(0));
          expect(bootstrapUser1Liquidity.free).bnEqual(
            bootstrapExpectedUserLiquidity
          );
          expect(bootstrapUser2Liquidity.reserved).bnEqual(new BN(0));
          expect(bootstrapUser2Liquidity.free).bnEqual(
            bootstrapExpectedUserLiquidity
          );
        }
        if (vesting === true) {
          expect(bootstrapUser1Liquidity.frozen).bnGt(new BN(0));
          expect(bootstrapUser2Liquidity.frozen).bnEqual(new BN(0));
        } else {
          expect(bootstrapUser1Liquidity.frozen).bnEqual(new BN(0));
          expect(bootstrapUser2Liquidity.frozen).bnEqual(new BN(0));
        }
      }
    );

    afterEach(async () => {
      const api = getApi();
      bootstrapPhase = await api.query.bootstrap.phase();
      expect(bootstrapPhase.toString()).toEqual("BeforeStart");
    });
  }
);

/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group maintenance
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  ExtrinsicResult,
  expectMGAExtrinsicSuDidSuccess,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import { setupApi, Extrinsic, setupUsers } from "../../utils/setup";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { BN_HUNDRED, signTx } from "@mangata-finance/sdk";
import { FOUNDATION_ADDRESS_1, MGA_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { ApiPromise } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import {
  AggregatorOptions,
  Staking,
  tokenOriginEnum,
} from "../../utils/Staking";
import { Maintenance } from "../../utils/Maintenance";
import { User } from "../../utils/User";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const users: User[] = [];
let api: ApiPromise;
let tests: { [K: string]: Extrinsic } = {};
let testUser1: User;
let testUser2: User;
let minStk: BN;
const foundationAccountAddress = FOUNDATION_ADDRESS_1;
//TODO: Goncer Need to change getTokenIds function in setup5PoolsChained
describe("On Maintenance mode - regular l1 updates must be forbidden", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    api = await getApi();
    tests = {
      updateL2fromL1: new L2Update(api)
        .withDeposit(
          await Rolldown.l2OriginRequestId(),
          users[0].keyRingPair.address,
          users[0].keyRingPair.address,
          BN_HUNDRED,
        )
        .build(),
    };
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOn(),
      ),
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value);
    });
  });
  it.each(["updateL2fromL1"])(
    "%s operation is not allowed in mm",
    async (testName) => {
      const extrinsic = tests[testName];
      const sequencer = await SequencerStaking.getSequencerUser();
      await Rolldown.waitForReadRights(sequencer.ethAddress);
      await signTx(api, extrinsic, sequencer.keyRingPair)
        .then((events) => {
          const event = getEventResultFromMangataTx(events, [
            "system",
            "ExtrinsicFailed",
          ]);
          expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
          expect(event.data).toContain("TradingBlockedByMaintenanceMode");
        })
        .catch((exc) => {
          expect(JSON.parse(JSON.stringify(exc)).data.toString()).toContain(
            "1010: Invalid Transaction: The swap prevalidation has failed",
          );
        });
    },
  );
  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
  });
});
describe("On Maintenance mode - sequencing and force updates are allowed", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    [testUser1, testUser2] = setupUsers();
    await setupApi();
    minStk = new BN(
      (await getApi()).consts.parachainStaking.minCandidateStk.toString(),
    );
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser1, minStk.muln(1000)),
      Assets.mintNative(testUser2, minStk.muln(1000)),
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOn(),
      ),
    );
  });
  it.todo("Sequencing & forced updates must be accepted", async () => {
    const aggregator = testUser1;
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser2,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          MGA_ASSET_ID,
          tokenOriginEnum.AvailableBalance,
        ),
      ),
      Sudo.sudoAs(
        aggregator,
        Staking.aggregatorUpdateMetadata(
          [testUser2],
          AggregatorOptions.ExtendApprovedCollators,
        ),
      ),
      Sudo.sudoAs(testUser2, Staking.updateCandidateAggregator(aggregator)),
    ).then((events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
    const candidateAggData = await Staking.candidateAggregator();
    expect(
      candidateAggData[testUser2.keyRingPair.address.toLowerCase()],
    ).toEqual(aggregator.keyRingPair.address.toLowerCase());
  });

  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
  });
});

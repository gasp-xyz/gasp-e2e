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
  EventResult,
} from "../../utils/eventListeners";
import {
  setupApi,
  Extrinsic,
  setupUsers,
  setupAsEthTokens,
  setupUsersWithBalances,
  getSudoUser,
} from "../../utils/setup";
import {
  getEventErrorFromSudo,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { BN_HUNDRED, signTx } from "gasp-sdk";
import { Sudo } from "../../utils/sudo";
import { ApiPromise } from "@polkadot/api";
import { Maintenance } from "../../utils/Maintenance";
import { User } from "../../utils/User";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { SudoDB } from "../../utils/SudoDB";
import { RollDown, Withdraw } from "../../utils/rolldown";
import { testLog } from "../../utils/Logger";
import {
  checkMaintenanceStatus,
  validateUpdateInMaintenanceModeStatus,
} from "../../utils/validators";
import { getCurrentNonce } from "../../utils/tx";
import { waitForNBlocks } from "../../utils/utils";
import { System } from "../../utils/System";
import { Assets } from "../../utils/Assets";
import { FoundationMembers } from "../../utils/FoundationMembers";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const users: User[] = [];
let api: ApiPromise;
let tests: { [K: string]: [Extrinsic, User] } = {};
let sequencer: User;
let user: User;
let foundationAccountAddress: string;

async function setupMm() {
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
  await checkMaintenanceStatus(true, false);
}
async function setupUpgradabilityMm() {
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchUpgradabilityInMaintenanceModeOff(),
    ),
  );
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
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchUpgradabilityInMaintenanceModeOn(),
    ),
  ).then((value) => {
    expectMGAExtrinsicSuDidSuccess(value);
  });
  await checkMaintenanceStatus(true, true);
}

describe.each(["mm", "upgradabilityMm"])(
  "On [%s] - regular l1 updates must be forbidden",
  (mmMode) => {
    let previous = "";
    beforeAll(async () => {
      await setupApi();
      api = await getApi();
      [user, sequencer] = setupUsers();
      const minSeq = (await SequencerStaking.minimalStakeAmount()).muln(100);
      await Sudo.batchAsSudoFinalized(
        Assets.mintNative(user),
        Assets.mintNative(sequencer, minSeq),
      );
      const foundationMembers = await FoundationMembers.getFoundationMembers();
      foundationAccountAddress = foundationMembers[0];
      await SequencerStaking.removeAllSequencers();
      await SequencerStaking.setupASequencer(sequencer);
    });

    beforeEach(async () => {
      // hacky trick to avoid double setup
      if (previous !== mmMode) {
        previous = mmMode;
        try {
          getApi();
        } catch (e) {
          await initApi();
        }
        sequencer = await SequencerStaking.getBaltatharSeqUser();
        users.push(...setupUsers());
        users.push(sequencer);
        await waitForNBlocks(2);
        if (mmMode === "mm") {
          testLog.getLog().info("Setting up maintenance mode");
          await setupMm();
        } else {
          testLog.getLog().info("Setting up upgradability in maintenance mode");
          await setupUpgradabilityMm();
        }
        testLog.getLog().info("...Done setting up maintenance mode");

        const tokenIds = await SudoDB.getInstance().getTokenIds(1);
        const [token] = await setupAsEthTokens(tokenIds);
        const tokenAddress = JSON.parse(token.toString()).ethereum;
        await setupUsersWithBalances(users, tokenIds.concat([GASP_ASSET_ID]));
        await Sudo.batchAsSudoFinalized(
          await SequencerStaking.provideSequencerStaking(
            users[2].keyRingPair.address,
          ),
        ).then((value) => {
          testLog
            .getLog()
            .info("Sequencer staking provided" + JSON.stringify(value));
          expectMGAExtrinsicSuDidSuccess(value);
        });
        tests = {
          updateL2fromL1: [
            new L2Update(api)
              .withDeposit(
                await Rolldown.lastProcessedRequestOnL2(),
                users[0].keyRingPair.address,
                users[0].keyRingPair.address,
                BN_HUNDRED,
              )
              .buildUnsafe(),
            sequencer,
          ],
          withdraw: [
            await Withdraw(users[0], BN_HUNDRED, tokenAddress.toString()),
            users[0],
          ],
          cancelRequestsFromL1: [
            await RollDown.cancelRequestsFromL1(123, false),
            sequencer,
          ],
          forceCancelRequestsFromL1: [
            Sudo.sudo(await RollDown.cancelRequestsFromL1(123, true)),
            getSudoUser(),
          ],
          forceUpdateL2fromL1: [
            Sudo.sudo(
              new L2Update(api)
                .withDeposit(
                  await Rolldown.lastProcessedRequestOnL2(),
                  users[0].keyRingPair.address,
                  users[0].keyRingPair.address,
                  BN_HUNDRED,
                )
                .forceBuild(),
            ),
            getSudoUser(),
          ],
          sequencerTearDown: [
            await SequencerStaking.leaveSequencerStaking(),
            users[2],
          ],
          mm: [await System.setCodeWithoutChecks(), getSudoUser()],
          upgradabilityMm: [await System.setCode(), getSudoUser()],
        };
      }
    });
    describe("On [%s] - regular l1 updates must be forbidden", () => {
      it.each([
        "updateL2fromL1",
        "withdraw",
        "cancelRequestsFromL1",
        "forceCancelRequestsFromL1",
        "forceUpdateL2fromL1",
      ])("%s operation is not allowed in mm", async (testName) => {
        const [extrinsic, signer] = tests[testName];
        if (testName === "updateL2fromL1") {
          await Rolldown.waitForReadRights(signer.toString(), 50);
        }
        const nonce = await getCurrentNonce(signer.keyRingPair.address);
        await signTx(api, extrinsic, signer.keyRingPair, { nonce: nonce })
          .then(async (events) => {
            let event: EventResult;
            try {
              event = getEventResultFromMangataTx(events, [
                "system",
                "ExtrinsicFailed",
              ]);
            } catch (e) {
              testLog.getLog().info("Perhaps a sudo event" + e);
              event = await getEventErrorFromSudo(events);
            }
            expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
            expect(event.data).toContain("BlockedByMaintenanceMode");
          })
          .catch((exc) => {
            testLog.getLog().error(exc);

            expect(JSON.parse(JSON.stringify(exc)).data.toString()).toContain(
              "1010: Invalid Transaction: The swap prevalidation has failed",
            );
          });
      });
      it.each(["sequencerSetup"])(
        "%s operations are allowed in mm",
        async (testName) => {
          testLog.getLog().info("DEBUG::TestName - " + testName);
          let usr: User;

          if (mmMode === "mm") {
            usr = users[1];
          } else {
            usr = user;
          }
          const extrinsic = await SequencerStaking.provideSequencerStaking(
            usr.keyRingPair.address,
          );
          const signer = getSudoUser();
          const nonce = await getCurrentNonce(signer.keyRingPair.address);
          await signTx(api, extrinsic, signer.keyRingPair, {
            nonce: nonce,
          }).then(async (events) => {
            const event = getEventResultFromMangataTx(events);
            testLog
              .getLog()
              .info("DEBUG::Event result - " + JSON.stringify(event));
            expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
          });
        },
      );
      it.each(["sequencerTearDown"])(
        "%s operations are allowed in mm",
        async (testName) => {
          testLog.getLog().info("DEBUG::TestName - " + testName);
          let signer: User;
          const [extrinsic, testsSigner] = tests[testName];
          if (mmMode === "mm") {
            signer = testsSigner;
          } else {
            signer = user;
          }
          const nonce = await getCurrentNonce(signer.keyRingPair.address);
          await signTx(api, extrinsic, signer.keyRingPair, {
            nonce: nonce,
          }).then(async (events) => {
            const event = getEventResultFromMangataTx(events);
            testLog
              .getLog()
              .info("DEBUG::Event result - " + JSON.stringify(event));
            expect(event.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
          });
        },
      );
      it("Update is blocked on maintenance mode but works on upgradeability", async () => {
        const test = tests[mmMode];
        // it will run mm or upgradabilityMm.
        const [extrinsic] = test;
        const result = await Sudo.asSudoFinalized(Sudo.sudo(extrinsic));
        const eventResult = await getEventErrorFromSudo(result);
        await validateUpdateInMaintenanceModeStatus(eventResult);
      });
    });
  },
);

afterAll(async () => {
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchUpgradabilityInMaintenanceModeOff(),
    ),
  );
  await Sudo.batchAsSudoFinalized(
    Sudo.sudoAsWithAddressString(
      foundationAccountAddress,
      Maintenance.switchMaintenanceModeOff(),
    ),
  );
});

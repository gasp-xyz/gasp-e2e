/*
 *
 * @group governance
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { eve, setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN_THOUSAND } from "@polkadot/util";
import { BN_HUNDRED } from "@mangata-finance/sdk";
import { User } from "../../utils/User";
import { FOUNDATION_ADDRESS_1 } from "../../utils/Constants";
import { Council, setupMaintenanceTests } from "../../utils/Council";
import {
  validateExtrinsicFailed,
  validateExtrinsicSuccess,
} from "../../utils/eventListeners";
import { findErrorMetadata } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());

let councilUsers: User[];
let proposalHashes: string[];
type TestItem = { address: string; validate: Function };
let testCases: { [id: string]: TestItem } = {};

describe("Council tests: Special rules for foundation addresses on mmOFF", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();

    const maintenanceTestsSettings = await setupMaintenanceTests(
      FOUNDATION_ADDRESS_1,
      false,
    );
    councilUsers = maintenanceTestsSettings.councilUsers;
    proposalHashes = maintenanceTestsSettings.proposalHashes;
    testCases = maintenanceTestsSettings.testCases;
  });
  it.each([
    ["Foundation", 6],
    ["NoFoundation", 7],
    ["NoCouncil", 9],
  ])(
    "Test that %s address can/cannot close an already voted proposal",
    async (test: string, index: number) => {
      const { address, validate } = testCases[test];
      const hash = proposalHashes[index];
      const propBefore = await Council.getProposal(hash);
      await Council.voteProposal(hash, councilUsers);
      const propIndex = JSON.parse(
        JSON.stringify(await Council.getVotes(hash)),
      ).index;
      const events = await Sudo.asSudoFinalized(
        Sudo.sudoAsWithAddressString(address, Council.close(hash, propIndex)),
      );
      const propAfter = await Council.getProposal(hash);
      validate(events, propAfter, propBefore);
    },
  );
  it.each([
    ["Foundation", 0],
    ["NoFoundation", 1],
  ])(
    "Test that %s address can/cannot veto a proposal",
    async (test: string, index: number) => {
      const address = testCases[test].address;
      const validate =
        test === "Foundation"
          ? validateExtrinsicSuccess
          : validateExtrinsicFailed;
      const hash = proposalHashes[index];
      const propBefore = await Council.getProposal(hash);
      const events = await Sudo.asSudoFinalized(
        Sudo.sudoAsWithAddressString(address, Council.veto(hash)),
      );
      const propAfter = await Council.getProposal(hash);
      validate(events, propAfter, propBefore);
    },
  );
  it("Test that sudo address can veto a proposal", async () => {
    const { validate } = testCases["Foundation"];
    const hash = proposalHashes[2];
    const propBefore = await Council.getProposal(hash);
    const events = await Sudo.asSudoFinalized(Sudo.sudo(Council.veto(hash)));
    const propAfter = await Council.getProposal(hash);
    validate(events, propAfter, propBefore);
  });

  it.each([
    ["Foundation", 3],
    ["NoFoundation", 4],
  ])(
    "Test that %s address can/cannot veto an already voted proposal",
    async (test: string, index: number) => {
      const address = testCases[test].address;
      const validate =
        test === "Foundation"
          ? validateExtrinsicSuccess
          : validateExtrinsicFailed;
      const hash = proposalHashes[index];
      const propBefore = await Council.getProposal(hash);
      await Council.voteProposal(hash, councilUsers);
      const events = await Sudo.asSudoFinalized(
        Sudo.sudoAsWithAddressString(address, Council.veto(hash)),
      );
      const propAfter = await Council.getProposal(hash);
      validate(events, propAfter, propBefore);
    },
  );
  it("Test that sudo address can veto an already voted proposal", async () => {
    const { validate } = testCases["Foundation"];
    const hash = proposalHashes[5];
    const propBefore = await Council.getProposal(hash);
    await Council.voteProposal(hash, councilUsers);
    const events = await Sudo.asSudoFinalized(Sudo.sudo(Council.veto(hash)));
    const propAfter = await Council.getProposal(hash);
    validate(events, propAfter, propBefore);
  });
  it("Test that sudo address cannot close an already voted proposal", async () => {
    const validate = validateExtrinsicFailed;
    const hash = proposalHashes[8];
    const propBefore = await Council.getProposal(hash);
    await Council.voteProposal(hash, councilUsers);
    const propIndex = JSON.parse(
      JSON.stringify(await Council.getVotes(hash)),
    ).index;
    const events = await Sudo.asSudoFinalized(
      Sudo.sudo(Council.close(hash, propIndex)),
    );
    const propAfter = await Council.getProposal(hash);
    validate(events, propAfter, propBefore);
  });
});
it("Test that Closing a motion requires some time for Council mebers but not for founders", async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  const councilUsers = await setupUsers();
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(
      councilUsers[0],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Assets.mintNative(
      councilUsers[1],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Assets.mintNative(
      councilUsers[2],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Assets.mintNative(
      councilUsers[3],
      BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT),
    ),
    Assets.mintNative(eve, BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT)),
    Sudo.sudo(Council.setMembers(councilUsers)),
  );
  const proposal = await Council.createProposals(councilUsers, 1);
  await Council.voteProposal(proposal[0], councilUsers);
  const propIndex = JSON.parse(
    JSON.stringify(await Council.getVotes(proposal[0])),
  ).index;
  const propBefore = await Council.getProposal(proposal[0]);
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      councilUsers[0].keyRingPair.address,
      Council.close(proposal[0], propIndex),
    ),
  );
  let propAfter = await Council.getProposal(proposal[0]);
  validateExtrinsicFailed(events, propAfter, propBefore);
  const error = getEventResultFromMangataTx(events, ["sudo", "SudoAsDone"]);
  const err = await findErrorMetadata(
    JSON.parse(JSON.stringify(error.data)).sudoResult.Err.Module.error,
    JSON.parse(JSON.stringify(error.data)).sudoResult.Err.Module.index,
  );
  expect(err.name).toEqual("TooEarlyToCloseByNonFoundationAccount");
  const eventsFundationUser = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      FOUNDATION_ADDRESS_1,
      Council.close(proposal[0], propIndex),
    ),
  );
  propAfter = await Council.getProposal(proposal[0]);
  validateExtrinsicSuccess(eventsFundationUser, propAfter, propBefore);
});
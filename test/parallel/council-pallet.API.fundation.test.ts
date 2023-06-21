/*
 *
 * @group governance
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers, Extrinsic, alice, api } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN_THOUSAND } from "@polkadot/util";
import { BN_HUNDRED, MangataGenericEvent } from "@mangata-finance/sdk";
import { User } from "../../utils/User";
import { FOUNDATION_ADDRESS_1 } from "../../utils/Constants";
import { Council } from "../../utils/Council";
import { System } from "../../utils/System";
import {
  expectMGAExtrinsicSuDidSuccess,
  expectMGAExtrinsicSuDidFailed,
} from "../../utils/eventListeners";
import { Option } from "@polkadot/types-codec";
import { Call } from "@polkadot/types/interfaces";
import { Maintenance } from "../../utils/Maintenance";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let councilUsers: User[];
let proposalHashes: string[];
type TestItem = { address: string; validate: Function };
const testCases: { [id: string]: TestItem } = {};

const maintenanceMode: {
  [id: string]: Extrinsic;
} = {};

describe.each(["mmON", "mmOFF"])(
  "Council tests: Special rules for foundation addresses on %s",
  (mm) => {
    beforeAll(async () => {
      try {
        getApi();
      } catch (e) {
        await initApi();
      }
      await setupApi();
      maintenanceMode["mmON"] = Maintenance.switchMaintenanceModeOn();
      maintenanceMode["mmOFF"] = Maintenance.switchMaintenanceModeOff();

      councilUsers = await setupUsers();
      councilUsers.push(alice);
      await Sudo.batchAsSudoFinalized(
        Assets.mintNative(
          councilUsers[0],
          BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT)
        ),
        Assets.mintNative(
          councilUsers[1],
          BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT)
        ),
        Assets.mintNative(
          councilUsers[2],
          BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT)
        ),
        Assets.mintNative(
          councilUsers[3],
          BN_HUNDRED.mul(BN_THOUSAND).mul(Assets.MG_UNIT)
        ),
        Sudo.sudo(Council.setMembers(councilUsers))
      );
      proposalHashes = await createProposals(councilUsers);
      testCases["Foundation"] = {
        address: FOUNDATION_ADDRESS_1,
        validate: validateOK,
      };
      testCases["NoFoundation"] = {
        address: councilUsers[3].keyRingPair.address,
        validate: validateNoOK,
      };
      const event = await await Sudo.asSudoFinalized(
        Sudo.sudoAsWithAddressString(FOUNDATION_ADDRESS_1, maintenanceMode[mm])
      );
      expectMGAExtrinsicSuDidSuccess(event);
    });
    it.each([
      ["Foundation", 6],
      ["NoFoundation", 7],
    ])(
      "Test that %s address can/cannot close an already voted proposal",
      async (test: string, index: number) => {
        const { address, validate } = testCases[test];
        const hash = proposalHashes[index];
        const propBefore = await getProposal(hash);
        await voteProposal(hash, councilUsers);
        const propIndex = JSON.parse(
          JSON.stringify(await getVotes(hash))
        ).index;
        const events = await Sudo.asSudoFinalized(
          Sudo.sudoAsWithAddressString(address, Council.close(hash, propIndex))
        );
        const propAfter = await getProposal(hash);
        validate(events, propAfter, propBefore);
      }
    );
    it.each([
      ["Foundation", 0],
      ["NoFoundation", 1],
    ])(
      "Test that %s address can/cannot veto a proposal",
      async (test: string, index: number) => {
        const { address, validate } = testCases[test];
        const hash = proposalHashes[index];
        const propBefore = await getProposal(hash);
        const events = await Sudo.asSudoFinalized(
          Sudo.sudoAsWithAddressString(address, Council.veto(hash))
        );
        const propAfter = await getProposal(hash);
        validate(events, propAfter, propBefore);
      }
    );
    it("Test that sudo address can veto a proposal", async () => {
      const { validate } = testCases["Foundation"];
      const hash = proposalHashes[2];
      const propBefore = await getProposal(hash);
      const events = await Sudo.asSudoFinalized(Sudo.sudo(Council.veto(hash)));
      const propAfter = await getProposal(hash);
      validate(events, propAfter, propBefore);
    });

    it.each([
      ["Foundation", 3],
      ["NoFoundation", 4],
    ])(
      "Test that %s address can/cannot veto an already voted proposal",
      async (test: string, index: number) => {
        const { address, validate } = testCases[test];
        const hash = proposalHashes[index];
        const propBefore = await getProposal(hash);
        await voteProposal(hash, councilUsers);
        const events = await Sudo.asSudoFinalized(
          Sudo.sudoAsWithAddressString(address, Council.veto(hash))
        );
        const propAfter = await getProposal(hash);
        validate(events, propAfter, propBefore);
      }
    );
    it("Test that sudo address can veto an already voted proposal", async () => {
      const { validate } = testCases["Foundation"];
      const hash = proposalHashes[5];
      const propBefore = await getProposal(hash);
      await voteProposal(hash, councilUsers);
      const events = await Sudo.asSudoFinalized(Sudo.sudo(Council.veto(hash)));
      const propAfter = await getProposal(hash);
      validate(events, propAfter, propBefore);
    });
    it("Test that sudo address cannot close an already voted proposal", async () => {
      const { validate } = testCases["NoFoundation"];
      const hash = proposalHashes[8];
      const propBefore = await getProposal(hash);
      await voteProposal(hash, councilUsers);
      const propIndex = JSON.parse(JSON.stringify(await getVotes(hash))).index;
      const events = await Sudo.asSudoFinalized(
        Sudo.sudo(Council.close(hash, propIndex))
      );
      const propAfter = await getProposal(hash);
      validate(events, propAfter, propBefore);
    });

    async function createProposals(users: User[]): Promise<string[]> {
      const num = 10;
      const userToSubmit = users[0];
      const txs: Extrinsic[] = [];
      for (let i = 0; i < num; i++) {
        const tx = Council.propose(
          users.length,
          System.remarkWithEvent(
            userToSubmit.keyRingPair.address + i.toString()
          ),
          54
        );
        txs.push(tx);
      }
      const events = await Sudo.asSudoFinalized(
        Sudo.sudoAs(userToSubmit, Sudo.batch(...txs))
      );
      const proposalHashes = events
        .filter((x) => x.event.method === "Proposed")
        .flatMap((x) => x.eventData[2].data.toString());
      return proposalHashes;
    }
    async function getProposal(hash: string) {
      return await api.query.council.proposalOf(hash);
    }
    async function getVotes(hash: string) {
      return await api.query.council.voting(hash);
    }
    async function voteProposal(hash: string, councilUsers: User[]) {
      const txs: Extrinsic[] = [];
      const proposal = await getVotes(hash);
      for (let i = 0; i < councilUsers.length; i++) {
        const tx = Sudo.sudoAs(
          councilUsers[i],
          Council.vote(
            hash,
            JSON.parse(JSON.stringify(proposal.toHuman())).index,
            "aye"
          )
        );
        txs.push(tx);
      }
      const events = await Sudo.batchAsSudoFinalized(...txs);
      return events;
    }
  }
);

function validateOK(
  events: MangataGenericEvent[],
  propAfter: Option<Call>,
  propBefore: Option<Call>
) {
  expectMGAExtrinsicSuDidSuccess(events);
  expect(propAfter.toHuman()).toBeNull();
  expect(propBefore.toHuman()).not.toBeNull();
}
function validateNoOK(
  events: MangataGenericEvent[],
  propAfter: Option<Call>,
  propBefore: Option<Call>
) {
  expectMGAExtrinsicSuDidFailed(events);
  expect(propAfter.toHuman()).not.toBeNull();
  expect(propBefore.toHuman()).not.toBeNull();
}

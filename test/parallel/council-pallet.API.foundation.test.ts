/*
 *
 * @group governance
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  Extrinsic,
  alice,
  api,
  eve,
  setupApi,
  setupUsers,
} from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";

import { BN_THOUSAND } from "@polkadot/util";
import { BN_HUNDRED, MangataGenericEvent } from "gasp-sdk";
import { User } from "../../utils/User";
import { FOUNDATION_ADDRESS_1, MGA_ASSET_ID } from "../../utils/Constants";
import { findErrorMetadata, waitForNBlocks } from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { Maintenance } from "../../utils/Maintenance";
import {
  expectMGAExtrinsicSuDidFailed,
  expectMGAExtrinsicSuDidSuccess,
} from "../../utils/eventListeners";
import { Option } from "@polkadot/types-codec";
import { Call } from "@polkadot/types/interfaces";
import { Council } from "../../utils/Council";
import BN from "bn.js";

jest.spyOn(console, "log").mockImplementation(jest.fn());

let councilUsers: User[];
let proposalHashes: string[];
type TestItem = { address: string; validate: Function };
const testCases: { [id: string]: TestItem } = {};

const maintenanceMode: {
  [id: string]: Extrinsic;
} = {};
let mode = "";

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
      testCases["Foundation"] = {
        address: FOUNDATION_ADDRESS_1,
        //fundation can only close motions when mm is ON.
        validate: validateExtrinsicSuccess,
      };
      testCases["NoFoundation"] = {
        address: councilUsers[3].keyRingPair.address,
        //Council members can close motions always.
        validate: validateExtrinsicSuccess,
      };
      testCases["NoCouncil"] = {
        address: eve.keyRingPair.address,
        //nonCouncil can not close any motion
        validate: validateExtrinsicFailed,
      };
      //ugly workaround to workaroudn the beforeAll jest missbehavior.
      if (mode.length === 0 || mode !== mm) {
        mode = mm;
        proposalHashes = await createProposals(councilUsers);
        //wait 6 mins 60 / 12 * 6 ::https://github.com/mangata-finance/mangata-node/blob/develop/runtime/mangata-rococo/src/lib.rs#L198
        await waitForNBlocks(61);
      }
      const event = await await Sudo.asSudoFinalized(
        Sudo.sudoAsWithAddressString(FOUNDATION_ADDRESS_1, maintenanceMode[mm]),
      );
      expectMGAExtrinsicSuDidSuccess(event);
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
        const propBefore = await getProposal(hash);
        await voteProposal(hash, councilUsers);
        const propIndex = JSON.parse(
          JSON.stringify(await getVotes(hash)),
        ).index;
        const events = await Sudo.asSudoFinalized(
          Sudo.sudoAsWithAddressString(address, Council.close(hash, propIndex)),
        );
        const propAfter = await getProposal(hash);
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
        const propBefore = await getProposal(hash);
        const events = await Sudo.asSudoFinalized(
          Sudo.sudoAsWithAddressString(address, Council.veto(hash)),
        );
        const propAfter = await getProposal(hash);
        validate(events, propAfter, propBefore);
      },
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
        const address = testCases[test].address;
        const validate =
          test === "Foundation"
            ? validateExtrinsicSuccess
            : validateExtrinsicFailed;
        const hash = proposalHashes[index];
        const propBefore = await getProposal(hash);
        await voteProposal(hash, councilUsers);
        const events = await Sudo.asSudoFinalized(
          Sudo.sudoAsWithAddressString(address, Council.veto(hash)),
        );
        const propAfter = await getProposal(hash);
        validate(events, propAfter, propBefore);
      },
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
      const validate = validateExtrinsicFailed;
      const hash = proposalHashes[8];
      const propBefore = await getProposal(hash);
      await voteProposal(hash, councilUsers);
      const propIndex = JSON.parse(JSON.stringify(await getVotes(hash))).index;
      const events = await Sudo.asSudoFinalized(
        Sudo.sudo(Council.close(hash, propIndex)),
      );
      const propAfter = await getProposal(hash);
      validate(events, propAfter, propBefore);
    });
  },
);
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
  const proposal = await createProposals(councilUsers, 1);
  await voteProposal(proposal[0], councilUsers);
  const propIndex = JSON.parse(
    JSON.stringify(await getVotes(proposal[0])),
  ).index;
  const propBefore = await getProposal(proposal[0]);
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      councilUsers[0].keyRingPair.address,
      Council.close(proposal[0], propIndex),
    ),
  );
  let propAfter = await getProposal(proposal[0]);
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
  propAfter = await getProposal(proposal[0]);
  validateExtrinsicSuccess(eventsFundationUser, propAfter, propBefore);
});

function validateExtrinsicSuccess(
  events: MangataGenericEvent[],
  propAfter: Option<Call>,
  propBefore: Option<Call>,
) {
  expectMGAExtrinsicSuDidSuccess(events);
  expect(propAfter.toHuman()).toBeNull();
  expect(propBefore.toHuman()).not.toBeNull();
}

function validateExtrinsicFailed(
  events: MangataGenericEvent[],
  propAfter: Option<Call>,
  propBefore: Option<Call>,
) {
  expectMGAExtrinsicSuDidFailed(events);
  expect(propAfter.toHuman()).not.toBeNull();
  expect(propBefore.toHuman()).not.toBeNull();
}
async function createProposals(users: User[], num = 10): Promise<string[]> {
  const userToSubmit = users[0];
  const txs: Extrinsic[] = [];
  for (let i = 0; i < num; i++) {
    const tx = Council.propose(
      users.length,
      api.tx.sudoOrigin.sudo(
        api.tx.tokens.mint(
          MGA_ASSET_ID,
          userToSubmit.keyRingPair.address,
          new BN(i).addn(1),
        ),
      ),
      44,
    );
    txs.push(tx);
  }
  const events = await Sudo.asSudoFinalized(
    Sudo.sudoAs(userToSubmit, Sudo.batch(...txs)),
  );
  return events
    .filter((x) => x.event.method === "Proposed")
    .flatMap((x) => x.eventData[2].data.toString());
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
        "aye",
      ),
    );
    txs.push(tx);
  }
  return await Sudo.batchAsSudoFinalized(...txs);
}

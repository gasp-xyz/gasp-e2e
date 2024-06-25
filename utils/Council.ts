import { BN_HUNDRED, BN_THOUSAND } from "@mangata-finance/sdk";
import { Assets } from "./Assets";
import { MGA_ASSET_ID } from "./Constants";
import { api, alice, eve, Extrinsic, setupUsers } from "./setup";
import { Sudo } from "./sudo";
import { User } from "./User";
import { BN } from "@polkadot/util";
import { waitForNBlocks } from "./utils";
import {
  expectMGAExtrinsicSuDidSuccess,
  validateExtrinsicFailed,
  validateExtrinsicSuccess,
} from "./eventListeners";
import { Maintenance } from "./Maintenance";

export class Council {
  static propose(threshold: number, extrinsic: Extrinsic, lenghtBound: number) {
    return api.tx.council.propose(threshold, extrinsic, lenghtBound);
  }
  static setMembers(councilMembers: User[]): Extrinsic {
    const addresses = councilMembers.flatMap((x) => x.keyRingPair.address);
    return api.tx.council.setMembers([...addresses], addresses[0], 0);
  }
  static veto(hash: string): Extrinsic {
    return api.tx.council.disapproveProposal(hash);
  }
  static close(hash: string, index: number): Extrinsic {
    return api.tx.council.close(
      hash,
      index,
      { refTime: "100000000000", proofSize: "0" },
      10000,
    );
  }
  static vote(hash: string, index: number, vote = "aye"): Extrinsic {
    return api.tx.council.vote(hash, index, vote === "aye");
  }

  static async getProposal(hash: string) {
    return await api.query.council.proposalOf(hash);
  }
  static async getVotes(hash: string) {
    return await api.query.council.voting(hash);
  }
  static async voteProposal(hash: string, councilUsers: User[]) {
    const txs: Extrinsic[] = [];
    const proposal = await api.query.council.voting(hash);
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

  static async createProposals(users: User[], num = 10): Promise<string[]> {
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
}

export async function setupMaintenanceTests(
  foundationAddress: string,
  MaintenanceMode: boolean,
) {
  type TestItem = { address: string; validate: Function };
  const testCases: { [id: string]: TestItem } = {};
  const councilUsers = await setupUsers();
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
    address: foundationAddress,
    //foundation can only close motions when mm is ON.
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
  const proposalHashes = await Council.createProposals(councilUsers);
  //wait 6 mins 60 / 6 * 6 ::https://github.com/mangata-finance/mangata-node/blob/develop/runtime/common/src/lib.rs#L1166C54-L1166C75
  await waitForNBlocks(61);

  if (MaintenanceMode) {
    const event = await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAddress,
        Maintenance.switchMaintenanceModeOn(),
      ),
    );
    expectMGAExtrinsicSuDidSuccess(event);
  } else {
    await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
  }
  return {
    councilUsers: councilUsers,
    proposalHashes: proposalHashes,
    testCases: testCases,
  };
}

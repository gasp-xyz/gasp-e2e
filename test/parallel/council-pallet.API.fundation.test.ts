/*
 *
 * @group parallel
 */
import { getApi, initApi } from "../../utils/api";
import { setupApi, setupUsers, Extrinsic, alice, api } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { BN_THOUSAND } from "@polkadot/util";
import { BN_HUNDRED } from "@mangata-finance/sdk";
import { User } from "../../utils/User";
import { FOUNDATION_ADDRESS_1 } from "../../utils/Constants";
import { Council } from "../../utils/Council";
import { System } from "../../utils/System";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

let councilUsers: User[];
let proposalHashes: string[];
describe("Council tests: Special rules for foundation addresses", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
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
    proposalHashes = await create20proposals(councilUsers);
  });
  it("Test that foundation address can veto a proposal", async () => {
    const hash = proposalHashes[0];
    const propBefore = await getProposal(hash);
    await Sudo.asSudoFinalized(
      Sudo.sudoAsWithAddressString(FOUNDATION_ADDRESS_1, Council.veto(hash))
    );
    const propAfter = await getProposal(hash);
    expect(propAfter.toHuman()).toBeUndefined();
    expect(propBefore.toHuman()).not.toBeUndefined();
  });

  async function create20proposals(users: User[]): Promise<string[]> {
    const twenty = 20;
    const userToSubmit = users[0];
    const txs: Extrinsic[] = [];
    for (let i = 0; i < twenty; i++) {
      const tx = Council.propose(
        users.length,
        System.remarkWithEvent(userToSubmit.keyRingPair.address + i.toString()),
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
});

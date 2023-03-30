import { api, Extrinsic } from "./setup";
import { User } from "./User";

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
}

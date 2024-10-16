import { api } from "./setup";
import { User } from "./User";

export class FoundationMembers {
  static changeKey(user: User) {
    const event = api.tx.foundationMembers.changeKey(user.keyRingPair.address);
    return event;
  }

  static async getFoundationMembers() {
    const members = JSON.parse(
      JSON.stringify(await api.query.foundationMembers.members()),
    );
    return members;
  }
}

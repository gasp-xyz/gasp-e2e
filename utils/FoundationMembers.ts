import { api } from "./setup";

export class FoundationMembers {
  static changeKey(userAddress: string) {
    const event = api.tx.foundationMembers.changeKey(userAddress);
    return event;
  }

  static async getFoundationMembers() {
    const members = JSON.parse(
      JSON.stringify(await api.query.foundationMembers.members()),
    );
    return members;
  }
}

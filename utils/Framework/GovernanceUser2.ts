import { Proposal } from "./Proposal";
import { User } from "./User";
import * as E from "./Errors";

export class GovernanceUser extends User {
  async vote(users: [User], stake: number): Promise<void> {
    const userAddresses: string[] = [];

    users.forEach((user) => {
      userAddresses.push(user.address!);
    });

    try {
      this.node
        .api!.tx.elections.vote(userAddresses, stake)
        .signAndSend(this.account.keyringPair!);
      this.votingStatus = "Voted";
    } catch (e) {
      throw new Error(e);
    }
  }

  async removeVote(): Promise<void> {
    if (this.votingStatus === "NotVoted") {
      throw new Error("User has not voted yet");
    }

    try {
      await this.node
        .api!.tx.elections.removeVoter()
        .signAndSend(this.account.keyringPair!);
      this.votingStatus = "NotVoted";
    } catch (e) {
      throw new Error(e);
    }
  }

  report(user: User): void {}

  async runForCouncil(): Promise<void> {
    if (this.candidacy !== "NotRunning") {
      throw new E.InvalidCandidacyStatus(
        "User is already running for council."
      );
    }

    try {
      const candidates = await this.node.api!.query.elections.candidates();
      await this.node!.api!.tx.elections.submitCandidacy(
        candidates.length
      ).signAndSend(this.account.keyringPair!);
      this.candidacy = "Candidate";
    } catch (e) {
      throw new Error(e);
    }
  }

  async renounceCandidacy(): Promise<void> {
    this.node
      .api!.tx.elections.renounceCandidacy()
      .signAndSend(this.account.keyringPair!);
  }

  proposeProposal(proposal: Proposal): void {
  }

  voteOnProposal(proposal: Proposal, vote: boolean): void {

  }

  close(proposal: Proposal): void {

  }

  defaultVote(vote: boolean): void {

  }
}

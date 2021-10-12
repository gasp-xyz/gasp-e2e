import { KeyringPair } from "@polkadot/keyring/types";
import { Token } from "./Token";
import { Node } from "./Node";
import { Proposal } from "./Proposal";

import * as E from "./Errors";

export class User {
  name: string;
  governanceStatus: UserGovernanceStatus;
  candidacy: Candidacy;
  votingStatus: VotingStatus;
  address: string | undefined;
  node: Node;

  account: {
    id?: number;
    mnemonic?: string;
    keyringPair?: KeyringPair;
    assets?: [Token];
  } = {};

  constructor(name: string, node: Node) {
    this.node = node;

    this.name = name;
    this.governanceStatus = "RegularUser";
    this.candidacy = "NotRunning";
    this.votingStatus = "NotVoted";
  }

  async vote(users: [User], stake: number): Promise<void> {
    if (this.votingStatus === "Voted") {
      throw new Error("User has voted already");
    }

    const userAddresses: string[] = [];

    users.forEach((user) => {
      userAddresses.push(user.address!);
    });

    try {
      this.node.api!.tx.elections.vote(userAddresses, stake);
      this.votingStatus = "Voted";
    } catch (e) {
      throw new Error(e);
    }
  }

  removeVote(): void {
    if (this.votingStatus === "NotVoted") {
      throw new Error("User has not voted yet");
    }

    try {
      this.node.api!.tx.elections.removeVoter();
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
      this.node!.api!.tx.elections.submitCandidacy(candidates.length);
      this.candidacy = "Candidate";
    } catch (e) {
      throw new Error(e);
    }
  }

  async renounceCandidacy(): Promise<void> {
    if (this.candidacy === "NotRunning") {
      throw new E.InvalidCandidacyStatus("User is not running for council");
    }

    try {
      let candidacyArgument: string;

      if (this.governanceStatus in ["PrimeCouncilMember", "CouncilMember"]) {
        candidacyArgument = "Member";
      } else if (this.governanceStatus in ["RunnerUp"]) {
        candidacyArgument = "RunnerUp";
      } else {
        const candidates = await this.node.api!.query.elections.candidates();
        candidacyArgument = "Candidate" + candidates.length;
      }

      this.node.api!.tx.elections.renounceCandidacy(candidacyArgument);
      this.candidacy = "NotRunning";
    } catch (e) {
      throw new Error(e);
    }
  }

  proposeProposal(proposal: Proposal): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new E.InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  voteOnProposal(proposal: Proposal, vote: boolean): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new E.InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  close(proposal: Proposal): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new E.InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  defaultVote(vote: boolean): void {
    if (this.governanceStatus in ["PrimeCouncilMember"]) {
    } else {
      throw new E.InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }
}

type UserGovernanceStatus =
  | "PrimeCouncilMember"
  | "CouncilMember"
  | "RunnerUp"
  | "RegularUser";

type Candidacy =
  | "Candidate"
  | "SuccessfulCandidate"
  | "UnsuccessfulCandidate"
  | "NotRunning";

type VotingStatus = "Voted" | "NotVoted";

import { KeyringPair } from "@polkadot/keyring/types";
import { Token } from "./Token";

import * as E from "./Errors";

export class User {
  name: string;
  governanceStatus: UserGovernanceStatus;
  candidacy: Candidacy;
  votingStatus: VotingStatus;
  address: string | undefined;

  account: {
    mnemonic?: string;
    keyringPair?: KeyringPair;
    assets?: [Token];
  } = {};

  constructor(name: string) {
    this.name = name;
    this.governanceStatus = "RegularUser";
    this.candidacy = "NotRunning";
    this.votingStatus = "NotVoted";
  }

  vote(users: [User]): void {
    if (this.votingStatus === "Voted") {
      throw new Error("User has voted already");
    }
  }

  removeVote(): void {
    if (this.votingStatus === "NotVoted") {
      throw new Error("User has not voted yet");
    }
  }

  report(user: User): void {}

  runForCouncil(): void {
    if (this.candidacy !== "NotRunning") {
      throw new E.InvalidCandidacyStatus(
        "User is already running for council."
      );
    }

    this.candidacy = "Candidate";
  }

  renounceCandidacy(): void {
    if (this.candidacy === "NotRunning") {
      throw new E.InvalidCandidacyStatus("User is not running for council.");
    }

    this.candidacy = "NotRunning";
  }

  proposeProposal(): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new E.InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  voteOnProposal(): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new E.InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  close(): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new E.InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  defaultVote(): void {
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

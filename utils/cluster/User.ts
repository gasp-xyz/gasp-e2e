import { Keyring } from "@polkadot/api";

export class User {
  name: string;
  governanceStatus: UserGovernanceStatus;
  candidacy: Candidacy;
  votingStatus: VotingStatus;

  keyring: Keyring;

  constructor(name: string) {
    this.name = name;
    this.governanceStatus = "RegularUser";
    this.candidacy = "NotRunning";
    this.votingStatus = "NotVoted";

    this.refresh();
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
    this.candidacy = "Candidate";
  }

  renounceCandidacy(): void {
    if (this.candidacy === "NotRunning") {
      throw new Error("User is not running for council.");
    }

    this.candidacy = "NotRunning";
  }

  refresh() {
    if (
      this.governanceStatus === "RegularUser" ||
      this.governanceStatus === "RunnerUp"
    ) {
      return {};
    }

    if (this.governanceStatus === "CouncilMember") {
      return {
        proposeProposal() {},
        voteOnProposal() {},
        close() {},
      };
    }

    if (this.governanceStatus === "PrimeCouncilMember") {
      return {
        proposeProposal() {},
        voteOnProposal() {},
        close() {},
        defaultVote() {},
      };
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

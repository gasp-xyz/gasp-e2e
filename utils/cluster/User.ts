import { InvalidGovernanceStatus } from "./Errors";

export class User {
  name: string;
  governanceStatus: UserGovernanceStatus;
  candidacy: Candidacy;
  votingStatus: VotingStatus;

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
    this.candidacy = "Candidate";
  }

  renounceCandidacy(): void {
    if (this.candidacy === "NotRunning") {
      throw new Error("User is not running for council.");
    }

    this.candidacy = "NotRunning";
  }

  proposeProposal(): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  voteOnProposal(): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  close(): void {
    if (this.governanceStatus in ["CouncilMember", "PrimeCouncilMember"]) {
    } else {
      throw new InvalidGovernanceStatus(
        `${this.name} is unable to call proposeProposal. GovernanceStatus: ${this.governanceStatus}`
      );
    }
  }

  defaultVote(): void {
    if (this.governanceStatus in ["PrimeCouncilMember"]) {
    } else {
      throw new InvalidGovernanceStatus(
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

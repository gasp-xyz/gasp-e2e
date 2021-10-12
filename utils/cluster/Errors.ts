export class InvalidGovernanceStatus extends Error {
  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, InvalidGovernanceStatus.prototype);
  }
}

export class InvalidVotingStatus extends Error {
  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, InvalidVotingStatus.prototype);
  }
}

export class InvalidCandidacyStatus extends Error {
  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, InvalidCandidacyStatus.prototype);
  }
}

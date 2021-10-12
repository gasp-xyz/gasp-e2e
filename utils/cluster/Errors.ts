export class InvalidGovernanceStatus extends Error {
  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, InvalidGovernanceStatus.prototype);
  }
}

export class KeyNotFoundError extends Error {
  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, KeyNotFoundError.prototype);
  }
}

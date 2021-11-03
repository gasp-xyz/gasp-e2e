import { getValidSecret } from "eciesjs/dist/utils";

describe("test string <-> buffer utils ", () => {
  it("should generate valid secret", () => {
    getValidSecret();
  });
});

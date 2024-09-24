import { getApi, initApi } from "../utils/api";
import "dotenv/config";
import { jest } from "@jest/globals";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("L1 update", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  test("test L1updates", async () => {});
});

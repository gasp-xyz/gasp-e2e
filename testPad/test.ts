import { getApi, initApi } from "../utils/api";
import "dotenv/config";

describe("L1 update", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
});

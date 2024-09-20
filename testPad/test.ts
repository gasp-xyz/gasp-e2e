import { getApi, initApi } from "../utils/api";
import "dotenv/config";
import { SequencerStaking } from "../utils/rollDown/SequencerStaking";
import { L2Update } from "../utils/rollDown/Rolldown";
import { hashL1Update } from "../utils/setupsOnTheGo";
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

  test("test L1updates", async () => {
    const sequencer = await SequencerStaking.getSequencerUser();
    const depositBatch = new L2Update(await getApi())
      .withDeposit(0, sequencer.toString(), sequencer.toString(), 1001)
      .buildParams();
    await hashL1Update(depositBatch);
  });
});

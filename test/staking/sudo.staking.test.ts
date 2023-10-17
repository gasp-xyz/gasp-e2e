/*
 *
 * @group parallel
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { expectMGAExtrinsicSuDidFailed } from "../../utils/eventListeners";
import { BN_ONE } from "@mangata-finance/sdk";
import { setupUsers, setupApi } from "../../utils/setup";
import { Staking } from "../../utils/Staking";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testCases: any;
beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  [testUser1] = setupUsers();
  await setupApi();
  testCases = {
    addStakingLiquidityToken: Staking.addStakingLiquidityToken(BN_ONE),
    removeStakingLiquidityToken: Staking.removeStakingLiquidityToken(BN_ONE),
    setCollatorCommission: Staking.setCollatorCommission(BN_ONE),
    setTotalSelected: Staking.setTotalSelected(BN_ONE),
  };
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser1));
});

describe("Test sudo actions", () => {
  beforeEach(async () => {});
  it.each([
    ["addStakingLiquidityToken"],
    ["removeStakingLiquidityToken"],
    ["setCollatorCommission"],
    ["setTotalSelected"],
  ])(
    "Test that noSudo users cannot do specific operations: %s",
    async (extrinsicName: string) => {
      const extrinsic = testCases[extrinsicName];
      const ERROR_MSG = "badOrigin";
      const events = await Sudo.asSudoFinalized(
        Sudo.sudoAs(testUser1, extrinsic),
      );
      const event = expectMGAExtrinsicSuDidFailed(events);
      //omg!
      const error = Object.keys(
        JSON.parse(event.event.data.toString())[0].err,
      )[0];
      expect(error).toEqual(ERROR_MSG);
    },
  );
});

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("staking - testpad", () => {
  beforeAll(async () => {
    //    try {
    //      getApi();
    //    } catch (e) {
    //      await initApi();
    //    }
  });

  test.only("fooSususu", async () => {
    console.info("asd")
  });
});

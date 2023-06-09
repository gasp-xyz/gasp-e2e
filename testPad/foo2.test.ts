/* eslint-disable no-console */
import { testLog } from "../utils/Logger";
require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

test("asdasdasd", () => {
  testLog.getLog().info("!!");
});

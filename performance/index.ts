//Example: ts-node performance/index.ts
//Options:
// run transfer

import { TestFactory, Tests } from "./testFactory";
import { testLog } from "../utils/Logger";
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.prompt();
rl.on("line", async (line: any) => {
  switch (line.trim()) {
    case "run transfer":
      const result = await TestFactory.BuildTestItem(
        Tests.ExtrinsicTransfer
      ).run();
      testLog.getLog().info(result);
      break;
    default:
      process.stdout.write("Option not found: available [run transfer] \n");

      break;
  }
  rl.prompt();
});

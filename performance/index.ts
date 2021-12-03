//Example: ts-node performance/index.ts
//Options:
// run transfer

import { TestFactory, Tests } from "./testFactory";
import { testLog } from "../utils/Logger";
import { TestParams } from "./testParams";
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.prompt("Hello");
rl.on("line", async (line: any) => {
  switch (line.trim()) {
    case "run transfer":
      await runExtrinsicTransfer();
      break;
    default:
      process.stdout.write("Option not found: available [run transfer] \n");

      break;
  }
  rl.prompt();
});
async function runExtrinsicTransfer() {
  const params = new TestParams();
  const result = await TestFactory.BuildTestItem(Tests.ExtrinsicTransfer).run(
    params
  );
  testLog.getLog().info(result);
}
runExtrinsicTransfer();

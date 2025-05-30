import { Commands, TestsCases } from "./testFactory";

export const logFile: string =
  new Date().toJSON().slice(0, 10) + "_" + new Date().toLocaleTimeString();
export class TestParams {
  public threads = 2;
  public pending = 10;
  public testCase?: TestsCases = undefined;
  public command?: Commands = undefined;
  public duration: number = 0;
  public totalTx: number = Number.MAX_VALUE;
  public throughput: number = 0;
  public nodes: string[] = [
    "wss://integration.mangatafinance.cloud:9944",
    //"wss://staging.mangatafinance.cloud:9944",
  ];
  public logFile: string = logFile;
}

import {Tests} from "./testFactory";

export class TestParams {
  public threads = 2;
  public testCase: Tests = Tests.Undefined;
  public duration: number = 0;
  public totalTx: number = 4;
  public nodes: string[] = [
    "wss://integration.mangatafinance.cloud:9944",
    //"wss://staging.mangatafinance.cloud:9944",
  ];
}

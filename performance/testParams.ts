export class TestParams {
  public threads = 2;
  public testCaseName: string = "transfer";
  public duration: number = 0;
  public totalTx: number = 4;
  public nodes: string[] = [
    "wss://integration.mangatafinance.cloud:9944",
    //"wss://staging.mangatafinance.cloud:9944",
  ];
}

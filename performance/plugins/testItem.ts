import { TestParams } from "../testParams";

export interface TestItem {
  arrange: (numberOfThreads: number, nodes: string[]) => Promise<boolean>;
  act: (testParams: TestParams) => Promise<boolean>;
  expect: () => Promise<boolean>;
  teardown: () => Promise<boolean>;
  run: (testParams: TestParams) => Promise<boolean>;
}

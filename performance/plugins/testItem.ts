import { TestParams } from "../testParams";

export interface TestItem {
  arrange: (numberOfThreads: number, nodes: string[]) => Promise<boolean>;
  act: () => Promise<boolean>;
  expect: () => Promise<boolean>;
  teardown: () => Promise<boolean>;
  run: (testParams: TestParams) => Promise<boolean>;
}

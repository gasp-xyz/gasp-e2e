import { TestParams } from "../testParams";

export interface TestItem {
  arrange: (testParams: TestParams) => Promise<boolean>;
  act: (testParams: TestParams) => Promise<boolean>;
  expect: (testParams: TestParams) => Promise<boolean>;
  teardown: () => Promise<boolean>;
  run: (testParams: TestParams) => Promise<boolean>;
}

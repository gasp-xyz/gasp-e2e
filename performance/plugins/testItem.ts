export interface TestItem {
  arrange: (param1: string, param2: string) => Promise<boolean>;
  act: () => Promise<boolean>;
  expect: () => Promise<boolean>;
  teardown: () => Promise<boolean>;
  run: () => Promise<boolean>;
}

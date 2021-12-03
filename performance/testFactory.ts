import { ExtrinsicTransfer } from "./plugins/extrinsicTransfer";
import { TestItem } from "./plugins/testItem";

export enum Tests {
  ExtrinsicTransfer,
}
export class TestFactory {
  public static BuildTestItem(type: Tests): TestItem {
    if (type === Tests.ExtrinsicTransfer) {
      return new ExtrinsicTransfer();
    }
    throw Error("TestItem not found");
  }
}

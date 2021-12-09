import {ExtrinsicSwap} from "./plugins/extrinsicSwap";
import {ExtrinsicTransfer} from "./plugins/extrinsicTransfer";
import {TestItem} from "./plugins/testItem";

export enum Tests {
  ExtrinsicTransfer,
  Swap,
}
export class TestFactory {
  public static BuildTestItem(type: Tests): TestItem {
    if (type === Tests.ExtrinsicTransfer) {
      return new ExtrinsicTransfer();
    }
    if (type === Tests.Swap) {
      return new ExtrinsicSwap();
    }
    throw Error("TestItem not found");
  }
}

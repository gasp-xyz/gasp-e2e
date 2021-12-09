import {ExtrinsicSwap} from "./plugins/extrinsicSwap";
import {ExtrinsicTransfer} from "./plugins/extrinsicTransfer";
import {TestItem} from "./plugins/testItem";

export enum Commands {
  ExtrinsicTransfer,
  Swap,
}

export enum TestsCases {
  ConcurrentTest,
  Rampup,
}
export class TestFactory {
  public static BuildTestItem(type: Commands): TestItem {
    if (type === Commands.ExtrinsicTransfer) {
      return new ExtrinsicTransfer();
    }
    if (type === Commands.Swap) {
      return new ExtrinsicSwap();
    }
    throw Error("TestItem not found");
  }
}

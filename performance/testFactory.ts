import { ExtrinsicSwap } from "./plugins/extrinsicSwap";
import { ExtrinsicTransfer } from "./plugins/extrinsicTransfer";
import { Ping } from "./plugins/ping";
import { TestItem } from "./plugins/testItem";

export enum Commands {
  ExtrinsicTransfer,
  ExtrinsicTransferKeepAlive,
  Swap,
  Ping,
}

export enum TestsCases {
  ConcurrentTest,
  Rampup,
  SustainedLoad,
  Burst,
}
export class TestFactory {
  public static BuildTestItem(type: Commands): TestItem {
    if (
      type === Commands.ExtrinsicTransfer ||
      type === Commands.ExtrinsicTransferKeepAlive
    ) {
      return new ExtrinsicTransfer();
    }
    if (type === Commands.Swap) {
      return new ExtrinsicSwap();
    }
    if (type === Commands.Ping) {
      return new Ping();
    }
    throw Error("TestItem not found");
  }
}

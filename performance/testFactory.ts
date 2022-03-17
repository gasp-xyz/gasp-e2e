import { ExtrinsicSwap } from "./plugins/extrinsicSwap";
import { ExtrinsicTransfer } from "./plugins/extrinsicTransfer";
import { ExtrinsicTransferAll } from "./plugins/extrinsicTransferAll";
import { Ping } from "./plugins/ping";
import { TestItem } from "./plugins/testItem";

export enum Commands {
  ExtrinsicTransfer,
  ExtrinsicTransferKeepAlive,
  ExtrinsicTransferAll,
  SwapSell,
  SwapBuy,
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
    if (type === Commands.SwapBuy || type === Commands.SwapSell) {
      return new ExtrinsicSwap();
    }
    if (type === Commands.Ping) {
      return new Ping();
    }
    if (type === Commands.ExtrinsicTransferAll) {
      return new ExtrinsicTransferAll();
    }
    throw Error("TestItem not found");
  }
}

// import { ExtrinsicBatch } from "./plugins/extrinsicBatch";
// import { ExtrinsicBurn } from "./plugins/extrinsicBurn";
// import { ExtrinsicMint } from "./plugins/extrinsicMint";
import { ExtrinsicSwap } from "./plugins/extrinsicSwap";
import { ExtrinsicTransfer } from "./plugins/extrinsicTransfer";
// import { ExtrinsicTransferAll } from "./plugins/extrinsicTransferAll";
// import { Ping } from "./plugins/ping";
import { TestItem } from "./plugins/testItem.js";
import { Extrinsic3rdPartySchedule } from "./plugins/extrinsic3rdPartySchedule";
import { Extrinsic3rdPartyClaim } from "./plugins/extrinsic3rdPartyClaim";
import { Extrinsic3rdPartyScheduleActivate } from "./plugins/extrinsic3rdPartyScheduleActivate";

export enum Commands {
  ExtrinsicTransfer,
  ExtrinsicTransferKeepAlive,
  ExtrinsicTransferAll,
  SwapSell,
  SwapBuy,
  Ping,
  Mint,
  Burn,
  ExtrinsicBatch,
  Schedule3rdParty,
  Claim3rdParty,
  ScheduleActivate3rdParty,
}

export enum TestsCases {
  ConcurrentTest,
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
    if (type === Commands.SwapBuy) {
      return new ExtrinsicSwap(true);
    }
    if (type === Commands.SwapSell) {
      return new ExtrinsicSwap(false);
    }
    if (type === Commands.Schedule3rdParty) {
      return new Extrinsic3rdPartySchedule();
    }
    if (type === Commands.Claim3rdParty) {
      return new Extrinsic3rdPartyClaim();
    }
    if (type === Commands.ScheduleActivate3rdParty) {
      return new Extrinsic3rdPartyScheduleActivate();
    }
    // if (type === Commands.Ping) {
    //   return new Ping();
    // }
    // if (type === Commands.ExtrinsicTransferAll) {
    //   return new ExtrinsicTransferAll();
    // }
    // if (type === Commands.Mint) {
    //   return new ExtrinsicMint();
    // }
    // if (type === Commands.Burn) {
    //   return new ExtrinsicBurn();
    // }
    // if (type === Commands.ExtrinsicBatch) {
    //   return new ExtrinsicBatch();
    // }
    throw Error("TestItem not found");
  }
}

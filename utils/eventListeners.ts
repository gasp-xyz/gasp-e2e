/* eslint-disable no-loop-func */
import { getApi } from "./api";
import { testLog } from "./Logger";

// lets create a enum for different status.
export enum ExtrinsicResult {
  ExtrinsicSuccess,
  ExtrinsicFailed,
  ExtrinsicUndefined,
}

///Class that stores the event result.
export class EventResult {
  /**
   *
   */
  constructor(
    state: ExtrinsicResult = ExtrinsicResult.ExtrinsicUndefined,
    data: any
  ) {
    this.state = state;
    this.data = data;
  }

  state: ExtrinsicResult;
  data: String;
}

// for testing
export const getEventResult = (
  section: any,
  method: any,
  module_index: any
) => {
  const api = getApi();

  return new Promise<EventResult>(async (resolve) => {
    const unsubscribe = await api.query.system.events((events: any) => {
      events.forEach((record: any) => {
        const { event } = record;
        if (event.section === section && event.method === method) {
          unsubscribe();
          resolve(
            new EventResult(
              ExtrinsicResult.ExtrinsicSuccess,
              JSON.parse(event.data.toString())
            )
          );
        } else if (
          event.section === "system" &&
          event.method === "ExtrinsicFailed" &&
          (JSON.parse(event.data.toString())[0].Module.index = module_index)
        ) {
          unsubscribe();
          resolve(
            new EventResult(
              ExtrinsicResult.ExtrinsicFailed,
              JSON.parse(event.data.toString())[0].Module.error
            )
          );
        }
      });
    });
  });
};

export const waitNewBlock = () => {
  const api = getApi();
  let count = 0;
  return new Promise(async (resolve) => {
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header: any) => {
      if (++count === 2) {
        testLog.getLog().info(`Chain is at block: #${header.number}`);
        unsubscribe();
        resolve(true);
      }
    });
  });
};
export const waitForAtLeastNCollators = (
  nAuthors: number,
  maxBlocks: number
) => {
  const api = getApi();
  let count = 0;
  const authors: string[] = [];
  return new Promise(async (resolve) => {
    const unsubscribe = await api.rpc.chain.subscribeNewHeads(
      async (head: any) => {
        const blockHashSignedByUser = await api.rpc.chain.getBlockHash(
          head.number.toNumber()
        );
        const header = await api.derive.chain.getHeader(blockHashSignedByUser);
        const author = header!.author!.toHuman() as string;
        authors.push(author);
        const nCollators = authors.filter(
          (item, i, ar) => ar.indexOf(item) === i
        ).length;
        if (nAuthors <= nCollators) {
          unsubscribe();
          resolve(true);
        }
        if (++count === maxBlocks) {
          testLog.getLog().info(`Chain is at block: #${header!.number}`);
          unsubscribe();
          resolve(false);
        }
      }
    );
  });
};
export async function waitNewBlockMeasuringTime(
  n: number
): Promise<Map<number, number>> {
  const api = getApi();
  let count = 0;
  let first = true;
  let startTime = Date.now();
  const times = new Map();
  await new Promise(async (resolve) => {
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header: any) => {
      if (!first) {
        const diff: Number = Date.now() - startTime;
        times.set(header.number, diff);
        startTime = Date.now();
      } else {
        first = false;
        startTime = Date.now();
      }
      if (++count === n + 2) {
        testLog.getLog().info(`Chain is at block: #${header.number}`);
        unsubscribe();
        resolve(times);
      }
    });
  });
  return times;
}

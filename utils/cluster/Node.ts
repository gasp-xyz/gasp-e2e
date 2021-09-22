import { ApiPromise } from "@polkadot/api";
import { initApi } from "../../utils/api";
import { testLog } from "../Logger";

export { Node };

class Node {
  name: string;
  connected: boolean;
  api?: ApiPromise;

  lastBlock?: number;
  lastHash?: string;
  hashes: Set<string> = new Set();
  subscription: any;

  constructor(name: string) {
    this.name = name;
    this.connected = false;
  }

  async connect(wsPath: string): Promise<void> {
    if (!this.connected) {
      this.api = await initApi(wsPath);
    }
  }

  async start(): Promise<void> {
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      (lastHeader) => {
        this.lastBlock = lastHeader.number.toNumber();
        this.lastHash = lastHeader.hash.toString();
        this.hashes.add(this.lastHash);
        testLog
          .getLog()
          .info(`${this.name} - #${this.lastBlock} - ${this.lastHash}`);
      }
    );
  }

  async stop(): Promise<void> {
    this.subscription();
  }
}

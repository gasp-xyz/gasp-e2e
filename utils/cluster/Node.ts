import { ApiPromise } from "@polkadot/api";
import { initApi } from "../../utils/api";
import { testLog } from "../Logger";

export { Node };

class Node {
  name: string;
  connected: boolean;
  api?: ApiPromise;

  firstBlock?: number;
  lastBlock?: number;
  lastHash?: string;
  hashes: Set<string> = new Set();
  blockHashes: Map<number, string> = new Map();
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
        if (!this.firstBlock) {
          this.firstBlock = lastHeader.number.toNumber();
        }
        this.lastBlock = lastHeader.number.toNumber();
        this.lastHash = lastHeader.hash.toString();
        this.hashes.add(this.lastHash);
        this.blockHashes.set(this.lastBlock, this.lastHash);
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

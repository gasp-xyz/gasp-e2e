import { ApiPromise } from "@polkadot/api";
import { initApi } from "../api";
import { testLog } from "../Logger";

class Node {
  name: string;
  connected: boolean;
  wsPath: string;
  api?: ApiPromise;

  firstBlock?: number;
  lastBlock?: number;
  lastHash?: string;
  hashes: Set<string> = new Set();
  blockHashes: Map<number, string> = new Map();
  blockNumbers: Set<number> = new Set();
  subscription: any;

  constructor(name: string, wsPath: string) {
    this.name = name;
    this.wsPath = wsPath;
    this.connected = false;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    this.api = await initApi(this.wsPath);
    this.connected = true;
  }

  async subscribeToHead(): Promise<void> {
    if (!this.connected) {
      throw new Error("The node is not connected yet.");
    }
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      (lastHeader) => {
        if (!this.firstBlock) {
          this.firstBlock = lastHeader.number.toNumber();
        }
        this.lastBlock = lastHeader.number.toNumber();
        this.lastHash = lastHeader.hash.toString();
        this.hashes.add(this.lastHash);
        this.blockNumbers.add(this.lastBlock);
        this.blockHashes.set(this.lastBlock, this.lastHash);
        testLog
          .getLog()
          .info(`${this.name} - #${this.lastBlock} - ${this.lastHash}`);
      },
    );
  }

  async stop(): Promise<void> {
    if (!this.connected) {
      throw new Error("The node is not connected yet.");
    }
    this.subscribeToHead();
  }

  prettyPrint(): string {
    return `
    ________________________________________
    | ${this.name}                          
    | ${this.wsPath}                        
    |_______________________________________
    | Connected       | ${this.connected}   
    | Block connected | ${this.firstBlock}  
    | Latest block    | ${this.lastBlock}   
    | Latest hash     | ${this.lastHash}    
    |_______________________________________`;
  }
}
export { Node };

import * as uuid from "uuid";
import { ApiPromise } from "@polkadot/api";
import { initApi } from "../../api";
import { testLog } from "../../Logger";

export class Node {
  name: string;
  connected: boolean;
  wsPath: string;
  api?: ApiPromise;

  firstBlock?: number;
  lastBlock?: number;
  lastHash?: string;
  hashes: Set<string> = new Set();
  blockHashes: Map<number, string> = new Map();
  subscription: any;

  electionEvents: Map<number, { candidates: any; members: any }> = new Map();

  constructor(wsPath: string) {
    this.name = uuid.v4();
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
      async (lastHeader) => {
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

        await this.api!.queryMulti(
          [
            this.api!.query.system.number,
            this.api!.query.elections.candidates,
            this.api!.query.elections.members,
          ],
          ([number, candidates, members]) => {
            testLog.getLog().info(`Election Information - ${this.lastBlock}
              Candidates: ${candidates.toJSON()}
              Members: ${members.toJSON()}`);

            this.electionEvents.set(parseInt(number.toString()), {
              candidates: candidates.toJSON(),
              members: members.toJSON(),
            });
          }
        );
      }
    );
  }

  async stop(): Promise<void> {
    if (!this.connected) {
      throw new Error("The node is not connected yet.");
    }
    this.subscribeToHead();
  }

  public checkElectionCandidates(block: number) {
    return this.electionEvents.get(block)!;
  }

  public prettyPrint(): string {
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

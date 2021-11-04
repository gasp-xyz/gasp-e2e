import * as uuid from "uuid";
import { ApiPromise } from "@polkadot/api";
import { testLog } from "../../Logger";
import { Mangata } from "mangata-sdk";
import { assert } from "console";
import { BaseUser } from "../User/BaseUser";

export class Node {
  name: string;
  wsPath: string | undefined;
  api?: ApiPromise;

  firstBlock?: number;
  lastBlock?: number;
  lastHash?: string;
  hashes: Set<string> = new Set();
  blockHashes: Map<number, string> = new Map();
  subscription: any;

  electionEvents: Map<number, { candidates: any; members: any }> = new Map();

  extrinsicEvents: Map<
    number,
    { event: { data: any; method: any; section: any } }[]
  > = new Map();

  constructor(wsPath?: string, api?: ApiPromise) {
    this.name = uuid.v4();
    if (!wsPath && !api) {
      assert(false, "Node must have a wsPath or an api");
    }
    if (wsPath) this.wsPath = wsPath;
    if (api) this.api = api;
  }

  async connect(): Promise<void> {
    if (this.wsPath) {
      this.api = await Mangata.getInstance(this.wsPath).getApi();
    }
  }

  async subscribeToHead(): Promise<void> {
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
          .debug(`${this.name} - #${this.lastBlock} - ${this.lastHash}`);
        await this.api!.queryMulti(
          [
            this.api!.query.elections.candidates,
            this.api!.query.elections.members,
          ],
          ([candidates, members]) => {
            this.electionEvents.set(this.lastBlock!, {
              candidates: candidates.toJSON(),
              members: members.toJSON(),
            });

            testLog.getLog().debug(
              `Saved Election Information 
               Candidates: ${
                 this.electionEvents.get(this.lastBlock!)?.candidates
               }
               Members: ${this.electionEvents.get(this.lastBlock!)?.members}`
            );
          }
        );
      }
    );
  }
  async subscribeToUserBalanceChanges(user: BaseUser): Promise<void> {
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      async (lastHeader) => {
        const balancesAtblock = await user.getAllUserTokens();
        user.userBalancesHistory.set(
          lastHeader.number.toNumber(),
          balancesAtblock
        );
      }
    );
  }
  async subscribeToTransactionsEvents(): Promise<void> {
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      async (lastHeader) => {
        const currentBlockEvents = await this.api!.query.system.events.at(
          lastHeader.hash
        );
        const listEvents: {
          event: { data: any; method: any; section: any };
        }[] = [];

        currentBlockEvents.forEach(({ event: { data, method, section } }) => {
          listEvents.push({ event: { data, method, section } });
        });
        this.extrinsicEvents.set(lastHeader.number.toNumber(), listEvents);
      }
    );
  }

  async stop(): Promise<void> {
    this.subscribeToHead();
  }

  public prettyPrint(): string {
    return `
    ________________________________________
    | ${this.name}                          
    | ${this.wsPath}                        
    |_______________________________________
    | Block connected | ${this.firstBlock}  
    | Latest block    | ${this.lastBlock}   
    | Latest hash     | ${this.lastHash}    
    |_______________________________________`;
  }
}

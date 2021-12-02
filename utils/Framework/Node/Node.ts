import * as uuid from "uuid";
import { ApiPromise } from "@polkadot/api";
import { initApi } from "../../api";
import { testLog } from "../../Logger";
import BN from "bn.js";
import { GovernanceUser } from "../User/GovernanceUser";

export class Node {
  name: string;
  wsPath: string;
  api?: ApiPromise;

  firstBlock?: number;
  lastBlock?: number;
  lastHash?: string;
  hashes: Set<string> = new Set();
  blockHashes: Map<number, string> = new Map();
  subscription: any;
  blockAuthors: Array<string> = new Array();

  electionEvents: Map<number, { candidates: any; members: any }> = new Map();
  userBalancesHistory: Map<
    number,
    Map<number, { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }>
  > = new Map();

  constructor(wsPath: string) {
    this.name = uuid.v4();
    this.wsPath = wsPath;
  }

  async connect(): Promise<void> {
    this.api = await initApi(this.wsPath);
  }

  async subscribeToHead(): Promise<void> {
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      async (lastHeader) => {
        if (!this.firstBlock) {
          this.firstBlock = lastHeader.number.toNumber();
        }
        this.blockAuthors.push((await this.api!.derive.chain.getHeader(lastHeader.hash.toString())).author.toString());
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
  async subscribeToUserBalanceChanges(
    candidate: GovernanceUser
  ): Promise<void> {
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      async (lastHeader) => {
        const balancesAtblock = await candidate.getAllUserTokens();
        this.userBalancesHistory.set(
          lastHeader.number.toNumber(),
          balancesAtblock
        );
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

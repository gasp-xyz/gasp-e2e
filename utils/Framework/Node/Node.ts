import * as uuid from "uuid";
import { ApiPromise } from "@polkadot/api";
import { initApi } from "../../api";
import { testLog } from "../../Logger";
import { BN } from "@polkadot/util";
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

  electionEvents: Map<number, { candidates: any; members: any }> = new Map();
  userBalancesHistory: Map<
    number,
    Map<number, { free: BN; reserved: BN; miscFrozen: BN; feeFrozen: BN }>
  > = new Map();
  systemExtrinics: any[] = [];
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
               Candidates: ${this.electionEvents.get(this.lastBlock!)
                 ?.candidates}
               Members: ${this.electionEvents.get(this.lastBlock!)?.members}`,
            );
          },
        );
      },
    );
  }
  async subscribeToUserBalanceChanges(
    candidate: GovernanceUser,
  ): Promise<void> {
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      async (lastHeader) => {
        const balancesAtblock = await candidate.getAllUserTokens();
        this.userBalancesHistory.set(
          lastHeader.number.toNumber(),
          balancesAtblock,
        );
      },
    );
  }
  async subscribeToExtrinsics(): Promise<void> {
    this.subscription = await this.api!.rpc.chain.subscribeNewHeads(
      async (lastHeader) => {
        const blockNo = lastHeader.number.toBn();
        const blockHash = await this.api!.rpc.chain.getBlockHash(blockNo);
        const signedBlock = await this.api!.rpc.chain.getBlock(blockHash);

        testLog.getLog().info(signedBlock.block.header.hash.toHex());

        // the hash for each extrinsic in the block
        signedBlock.block.extrinsics.forEach((ex, index) => {
          testLog.getLog().info(index + JSON.stringify(ex.toHuman()));
          this.systemExtrinics.push(ex);
        });
      },
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

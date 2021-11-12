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
  events: Map<string, any> = new Map();

  electionEvents: Map<number, { candidates: any; members: any }> = new Map();
  termEvents: Map<string, [{blockNumber: number, candidates: any, members: any}]> = new Map();

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
          async ([candidates, members]) => {
            this.electionEvents.set(this.lastBlock!, {
              candidates: candidates.toJSON(),
              members: members.toJSON(),
            });

            let termHash = (await this.api!.derive.elections.info()).termDuration.hash.toString();

            let termEvent = this.termEvents.get(termHash); // termEvent || Null
            if (termEvent) { // Append if term exists
              termEvent.push({
                blockNumber: lastHeader.number.toNumber(),
                candidates: candidates.toJSON(),
                members: members.toJSON(),
            })} else { // Create if term doesn't already exist
              this.termEvents.set(
                termHash,
                [{
                  blockNumber: lastHeader.number.toNumber(),
                  candidates: candidates.toJSON(),
                  members: members.toJSON()
                }]
              )
            }

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

  async subscribeToEvents() {
    const promises = [];
    let _tmpevents: [any, any, any] = [null, null, null];

    const p = new Promise((): void => {
      // Subscribe to system events via storage
      this.api!.query.system.events((events: any): void => {
        testLog
          .getLog()
          .info(
            `[ ${new Date().toUTCString()}] - Received ${
              events.length
            } events: -------`
          );

        // Loop through the Vec<EventRecord>
        events.forEach((record: any) => {
          // Extract the phase, event and the event types
          const { event, phase } = record;
          const types = event.typeDef;

          _tmpevents = [event, phase, types];

          // Show what we are busy with
          let eventMessage = `[ ${new Date().toUTCString()}] - \t${
            event.section
          }:${event.method}`;

          // Loop through each of the parameters, displaying the type and data
          event.data.forEach((data: any, index: any) => {
            eventMessage += ` [${types[index].type}: ${data.toString()}] `;
          });
          testLog.getLog().info(eventMessage);
        });
      });
    });
    promises.push(p);

    this.events.set(
      this.lastHash!,
      _tmpevents
    );

    await Promise.all(promises).then((values) => {
      testLog.getLog().info(values.toString());
    });

    testLog.getLog().info("----------------");``
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

import * as E from "fp-ts/Either";

import { AnyJson } from "@polkadot/types/types";
import { ApiPromise } from "@polkadot/api";
import { initApi } from "../../utils/api";
import { testLog } from "../Logger";
import { KeyNotFoundError } from "../Errors";

export { Node };

export type ElectionState = {
  candidates: AnyJson;
  members: AnyJson;
};

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
  subscription: any;

  electionHistory: Map<string, ElectionState> = new Map();

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
      async (lastHeader) => {
        if (!this.firstBlock) {
          this.firstBlock = lastHeader.number.toNumber();
        }
        this.lastBlock = lastHeader.number.toNumber();
        this.lastHash = lastHeader.hash.toString();
        this.hashes.add(this.lastHash);
        this.blockHashes.set(this.lastBlock, this.lastHash);

        await this._saveElectionInformation(lastHeader.hash.toString());

        testLog
          .getLog()
          .info(`${this.name} - #${this.lastBlock} - ${this.lastHash}`);

        E.fold(
          (eitherError: KeyNotFoundError) => {
            testLog.getLog().info(
              `
              ElectionInformation - Unable to find Block ${this.lastHash}
              `
            );
          },
          (state: ElectionState) => {
            testLog.getLog().info(
              `
              ElectionInformation - Block ${this.lastHash}
                Candidates: ${state.candidates}
                Members: ${state.members}
              `
            );
          }
        )(this.getElectionStateByBlockHash(lastHeader.hash.toString()));
      }
    );
  }

  async _saveElectionInformation(blockHash: string): Promise<void> {
    if (!this.connected) {
      throw new Error("The node is not connected yet.");
    }

    await this.api?.queryMulti(
      [this.api?.query.elections.candidates, this.api?.query.elections.members],
      ([candidates, members]) => {
        const _candidates = candidates.toJSON();
        const _members = members.toJSON();
        this.electionHistory.set(blockHash, {
          candidates: _candidates,
          members: _members,
        });
        testLog.getLog().info(`Added ${blockHash} to election history.`);
      }
    );
  }

  async stop(): Promise<void> {
    if (!this.connected) {
      throw new Error("The node is not connected yet.");
    }
    this.subscription();
    this.connected = false;
  }

  getElectionStateByBlockHash(
    blockHash: string
  ): E.Either<KeyNotFoundError, ElectionState> {
    return E.fromNullable(new KeyNotFoundError("Key not found"))(
      this.electionHistory.get(blockHash)
    );
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

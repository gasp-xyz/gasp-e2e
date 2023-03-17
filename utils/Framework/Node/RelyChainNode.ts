import { ApiPromise, WsProvider } from "@polkadot/api";
import { getEnvironmentRequiredVars } from "../../utils.js";
import { Node } from "./Node.js";

export class RelyChainNode extends Node {
  async connect(): Promise<void> {
    const { relyUri } = getEnvironmentRequiredVars();
    const wsProvider = new WsProvider(relyUri);
    const api = await ApiPromise.create({
      provider: wsProvider,
    });
    this.api = api;
  }

  public prettyPrint(): string {
    return `
    ________________________________________
    | RELY NODE ${this.name}                          
    | ${this.wsPath}                        
    |_______________________________________
    | Block connected | ${this.firstBlock}  
    | Latest block    | ${this.lastBlock}   
    | Latest hash     | ${this.lastHash}    
    |_______________________________________`;
  }
}

import { ApiPromise, WsProvider } from "@polkadot/api";
import { Node } from "./Node.js";

export class AcalaNode extends Node {
  async connect(): Promise<void> {
    const provider = new WsProvider(this.wsPath);
    const api = await ApiPromise.create({
      provider: provider,
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

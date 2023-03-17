import { BN } from "@polkadot/util";
import { ExtrinsicResult } from "../../eventListeners.js";
import { SudoUser } from "../../Framework/User/SudoUser.js";
import { mintAsset } from "../../tx.js";
import { getEventResultFromMangataTx } from "../../txHandler.js";
import { Token } from "./Token.js";

export class Bank {
  sudoUser: SudoUser;
  tokens: Token[] | undefined;
  id = new BN(0);

  constructor(sudoUser: SudoUser) {
    this.sudoUser = sudoUser;
  }

  public async mintToken(
    supply: BN,
    targetUserAddress: string
  ): Promise<Token> {
    this.id.add(new BN(1));
    const token = new Token(this.id, supply);

    await mintAsset(
      this.sudoUser.keyRingPair,
      this.id,
      targetUserAddress,
      supply
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Minted",
        this.sudoUser.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });

    if (this.tokens === undefined) {
      this.tokens = [token];
    } else {
      this.tokens.push(token);
    }

    return token;
  }
}

/*
 * eslint-disable no-console
 */

import { Command, flags } from "@oclif/command";

export default class FundAccount extends Command {
  static description = "Fund an account";

  static examples = [
    `$ cheat-code fundAccount --to=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY --amount=1000000`,
  ];

  static flags = {
    help: flags.help({ char: "h" }),
    to: flags.string({ char: "t", description: "send funds to this account" }),
    amount: flags.integer({ char: "a", description: "amount to fund" }),
  };

  async run() {
    const { flags } = this.parse(FundAccount);

    const account = flags.to;
    const amount = flags.amount;

    // TODO: Call fund account function with these arguments
    // eslint-disable-next-line
    console.log(`Account: ${account}, Amount: ${amount}`);
  }
}

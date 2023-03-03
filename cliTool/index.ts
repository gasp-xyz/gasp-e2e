/* eslint-disable no-console */
/**
 * npx ts-node cliTool/index.ts --runInBand
 */
import inquirer from "inquirer";
import {
  giveTokensToUser,
  joinAFewCandidates,
  joinAsCandidate,
  setupPoolWithRewardsForDefaultUsers,
} from "../utils/setupsOnTheGo";
import { findErrorMetadata, getEnvironmentRequiredVars } from "../utils/utils";
import { Node } from "../utils/Framework/Node/Node";
import { SudoUser } from "../utils/Framework/User/SudoUser";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../utils/api";
import { User } from "../utils/User";
//const inquirer = require("inquirer");

async function app(): Promise<any> {
  return inquirer
    .prompt({
      type: "list",
      message: "Select setup",
      name: "option",
      choices: [
        "Setup rewards with default users",
        "Join as candidate",
        "Fill with candidates",
        "Give tokens to user",
        "Foo",
        "Find Error",
        "Enable liq token",
        "Is collator chosen?",
      ],
    })
    .then(async (answers) => {
      console.log("Answers::: " + JSON.stringify(answers, null, "  "));
      if (answers.option.includes("Setup rewards with default users")) {
        const setupData = await setupPoolWithRewardsForDefaultUsers();
        console.log("liq Id = " + setupData.liqId);
      }
      if (answers.option.includes("Join as candidate")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "default //Charlie",
            },
            {
              type: "input",
              name: "liq",
              message: "liq id",
            },
          ])
          .then(async (answers) => {
            await joinAsCandidate(answers.user, answers.liq);
            console.log("Done");
            return app();
          });
      }
      if (answers.option.includes("Give tokens to user")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "default //Charlie",
            },
            {
              type: "input",
              name: "liq",
              message: "liq id",
            },
          ])
          .then(async (answers) => {
            await giveTokensToUser(answers.user, answers.liq);
            console.log("Done");
            return app();
          });
      }
      if (answers.option.includes("Find Error")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "hex",
              message: "",
            },
            {
              type: "input",
              name: "index",
              message: "",
            },
          ])
          .then(async (answers) => {
            await findErrorMetadata(answers.hex, answers.index);
            console.log("Done");
            return app();
          });
      }
      if (answers.option.includes("Enable liq token")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqToken",
              message: "",
            },
          ])
          .then(async (answers) => {
            const node = new Node(getEnvironmentRequiredVars().chainUri);
            await node.connect();
            const keyring = new Keyring({ type: "sr25519" });
            const sudo = new SudoUser(keyring, node);
            await sudo.addStakingLiquidityToken(answers.liqToken);
            console.log("Done");
            return app();
          });
      }
      if (answers.option.includes("Is collator chosen?")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "",
            },
          ])
          .then(async (answers) => {
            await initApi();
            const api = await getApi();
            const collators =
              await api.query.parachainStaking.selectedCandidates();
            const keyring = new Keyring({ type: "sr25519" });
            const user = new User(keyring, answers.user);
            const result = collators.find(
              (x) => x.toString() === user.keyRingPair.address
            );
            console.info(result?.toString());
            console.info(
              `Is collator selected? : ${
                result && result.toString()?.length > 0 ? true : false
              }`
            );
            return app();
          });
      }
      if (answers.option.includes("Fill with candidates")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqToken",
              message: "",
            },
            {
              type: "input",
              name: "numCandidates",
              message: "",
            },
          ])
          .then(async (answers) => {
            await joinAFewCandidates(answers.numCandidates, answers.liqToken);
            return app();
          });
      }
      return app();
    });
}

const main = async () => {
  await app();
};
main();

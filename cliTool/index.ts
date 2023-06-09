/* eslint-disable no-console */
/**
 * npx ts-node cliTool/index.ts --runInBand
 * API_URL="wss://mangata-x.api.onfinality.io/public-ws"  npx ts-node ./index.ts --runInBand
 */
import inquirer from "inquirer";
import {
  giveTokensToUser,
  joinAFewCandidates,
  joinAsCandidate,
  setupPoolWithRewardsForDefaultUsers,
  fillWithDelegators,
  printCandidatesNotProducing,
  createCustomPool,
  setupACouncilWithDefaultUsers,
  vetoMotion,
} from "../utils/setupsOnTheGo";
import {
  findErrorMetadata,
  getEnvironmentRequiredVars,
  printCandidatePowers,
  swapEachNBlocks,
} from "../utils/utils";
import { Node } from "../utils/Framework/Node/Node";
import { SudoUser } from "../utils/Framework/User/SudoUser";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../utils/api";
import { User } from "../utils/User";
import { Mangata } from "@mangata-finance/sdk";

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
        "Get powers",
        "Fill with delegators",
        "Swap each 11 blocks",
        "From string to Hex",
        "get pools",
        "Who is offline",
        "createPool",
        "createACouncil",
        "veto",
      ],
    })
    .then(async (answers: { option: string | string[] }) => {
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
          .then(
            async (answers: {
              user: string | undefined;
              liq: number | undefined;
            }) => {
              await joinAsCandidate(answers.user, answers.liq);
              console.log("Done");
              return app();
            }
          );
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
          .then(
            async (answers: {
              user: string | undefined;
              liq: number | undefined;
            }) => {
              await giveTokensToUser(answers.user, answers.liq);
              console.log("Done");
              return app();
            }
          );
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
          .then(async (answers: { hex: string; index: string }) => {
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
          .then(async (answers: { liqToken: import("bn.js") }) => {
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
          .then(async (answers: { user: string | undefined }) => {
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
          .then(
            async (answers: {
              numCandidates: number | undefined;
              liqToken: number | undefined;
            }) => {
              await joinAFewCandidates(answers.numCandidates, answers.liqToken);
              return app();
            }
          );
      }
      if (answers.option.includes("Fill with delegators")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqToken",
              message: "",
            },
            {
              type: "input",
              name: "numDelegators",
              message: "",
            },
            {
              type: "input",
              name: "targetAddress",
              message: "",
            },
          ])
          .then(
            async (answers: {
              numDelegators: number;
              liqToken: number;
              targetAddress: string;
            }) => {
              await fillWithDelegators(
                answers.numDelegators,
                answers.liqToken,
                answers.targetAddress
              );
              return app();
            }
          );
      }
      if (answers.option.includes("Get powers")) {
        await printCandidatePowers();
      }
      if (answers.option.includes("Swap each 11 blocks")) {
        await swapEachNBlocks(11);
      }
      if (answers.option.includes("From string to Hex")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "str",
              message: "",
            },
          ])
          .then(async (answers) => {
            await initApi();
            const api = await getApi();
            const str = api.createType("Vec<u8>", answers.str);
            console.info(str.toString());
            return app();
          });
      }
      if (answers.option.includes("get pools")) {
        const mga = Mangata.instance([
          "wss://prod-kusama-collator-01.mangatafinance.cloud",
        ]);
        const pools = mga.getPools();
        (await pools).forEach((pool) => console.info(JSON.stringify(pool)));
        return app();
      }
      if (answers.option.includes("createPool")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "User",
            },
            {
              type: "input",
              name: "ratio",
              message: "ratio",
            },
            {
              type: "bool",
              name: "mgaBig",
              message: "MGX bigger?",
            },
          ])
          .then(async (answers) => {
            await initApi();
            const mgaBig = answers.mgaBig === "true";
            const ratio = parseInt(answers.ratio.toString());
            const user = answers.user;
            await createCustomPool(mgaBig, ratio, user);
            return app();
          });
      }
      if (answers.option.includes("createACouncil")) {
        await initApi();
        await setupACouncilWithDefaultUsers();
        return app();
      }
      if (answers.option.includes("veto")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "motion",
              message: "motion_no",
            },
          ])
          .then(async (answers) => {
            await initApi();
            await vetoMotion(answers.motion);
            return app();
          });
      }
      if (answers.option.includes("Who is offline")) {
        await printCandidatesNotProducing();
      }
      return app();
    });
}

const main = async () => {
  await app();
};
main();

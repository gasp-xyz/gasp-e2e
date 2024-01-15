/* eslint-disable no-console */
/**
 * cd cliTool
 * yarn
 * npx ts-node index.ts --runInBand
 * If you want to define the url ( default is localhost:9946 )
 * API_URL="wss://mangata-x.api.onfinality.io/public-ws"  npx ts-node ./index.ts --runInBand
 * or:
 * node --experimental-specifier-resolution=node --loader ts-node/esm --experimental-vm-modules  ./index.ts --runInBand
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
  migrate,
  userAggregatesOn,
  subscribeAndPrintTokenChanges,
  provisionWith100Users,
  findAllRewardsAndClaim,
  setupTokenWithRewardsForDefaultUsers,
  testTokensForUsers,
  replaceByStateCall,
  burnAllTokensFromPool,
  createProposal,
  printAllTxsDoneByUser,
  vote,
  close,
  printUserInfo,
  activateAndClaim3rdPartyRewardsForUser,
  claimForAllAvlRewards,
  addActivatedLiquidityFor3rdPartyRewards,
  addActivatedLiquidityForNativeRewards,
  addStakedUnactivatedReserves,
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
import { BN_ZERO, Mangata } from "@mangata-finance/sdk";
import { encodeAddress } from "@polkadot/keyring";
import { stringToU8a, bnToU8a, u8aConcat, BN } from "@polkadot/util";
import { Sudo } from "../utils/sudo";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";

async function app(): Promise<any> {
  return inquirer
    .prompt({
      type: "list",
      message: "Select setup",
      name: "option",
      choices: [
        "Setup rewards with default users",
        "Create Proposal",
        "Vote",
        "CloseProposal",
        "Setup a collator with token",
        "Join as candidate",
        "Fill with candidates",
        "Give tokens to user",
        "Mint token to user",
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
        "migrateData",
        "user aggregates with",
        "listen token balance changes",
        "provisionWith100Users",
        "find and claim all rewards",
        "Setup token rewards with default users",
        "slibing",
        "proof crowdloan",
        "testTokensForUsers",
        "rpc_chops",
        "Empty pool created by default users",
        "Print user txs",
        "Print user info",
        "Activate and claim 3rd party rewards to default users",
        "Claim 4 all avl rewards",
        "Add activated 3rd party rewards liquidity",
        "Add activated native rewards liquidity",
        "Staked liq that is not activated",
      ],
    })
    .then(async (answers: { option: string | string[] }) => {
      console.log("Answers::: " + JSON.stringify(answers, null, "  "));
      if (answers.option.includes("Setup rewards with default users")) {
        const setupData = await setupPoolWithRewardsForDefaultUsers();
        console.log("liq Id = " + setupData.liqId);
      }
      if (answers.option.includes("Claim 4 all avl rewards")) {
        await claimForAllAvlRewards();
      }
      if (answers.option.includes("Setup token rewards with default users")) {
        await setupTokenWithRewardsForDefaultUsers();
      }
      if (answers.option.includes("Empty pool created by default users")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqToken",
              message: "default 9",
              default: "9",
            },
          ])
          .then(async (answers: { liqToken: string }) => {
            await burnAllTokensFromPool(new BN(answers.liqToken));
          });
      }
      if (answers.option.includes("Vote")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "proposalId",
              message: " id",
              default: "0",
            },
          ])
          .then(async (answers: { proposalId: number }) => {
            await vote(answers.proposalId);
          });
      }
      if (answers.option.includes("CloseProposal")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "proposalId",
              message: " id",
              default: "0",
            },
          ])
          .then(async (answers: { proposalId: number }) => {
            await close(answers.proposalId);
          });
      }
      if (answers.option.includes("Print user txs")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "userAddress",
              message: "default Alice",
              default: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            },
          ])
          .then(async (answers: { userAddress: string }) => {
            await printAllTxsDoneByUser(answers.userAddress);
          });
      }
      if (answers.option.includes("Print user info")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "userAddress",
              message: "default Alice",
              default: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
            },
          ])
          .then(async (answers: { userAddress: string }) => {
            await printUserInfo(answers.userAddress);
            console.log("Done");
            return app();
          });
      }
      if (answers.option.includes("Setup a collator with token")) {
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
            {
              type: "input",
              name: "amount",
              message: "amountToJoin",
            },
          ])
          .then(
            async (answers: {
              user: string | undefined;
              liq: number | undefined;
              amount: string | 0;
            }) => {
              let liq = new BN(answers.liq!.toString());
              const amount = new BN(answers.amount!.toString());
              if (liq!.eq(BN_ZERO)) {
                const setupData = await setupPoolWithRewardsForDefaultUsers();
                console.log("liq Id = " + setupData.liqId);
                liq = new BN(setupData.liqId);
              }
              const node = new Node(getEnvironmentRequiredVars().chainUri);
              await node.connect();
              const keyring = new Keyring({ type: "sr25519" });
              const sudo = new SudoUser(keyring, node);
              await sudo.addStakingLiquidityToken(liq);
              await joinAsCandidate(
                answers.user,
                liq?.toNumber(),
                new BN(amount),
              );
              console.log("Done");
              return app();
            },
          );
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
            },
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
            },
          );
      }
      if (answers.option.includes("Mint token to user")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "user",
              default: "//Alice",
            },
            {
              type: "input",
              name: "tokenId",
              message: "token id",
            },
            {
              type: "input",
              name: "amount",
              message: "amount",
            },
          ])
          .then(
            async (answers: {
              user: string;
              tokenId: number;
              amount: number;
            }) => {
              try {
                getApi();
              } catch (e) {
                await initApi();
              }
              await setupApi();
              await setupUsers();
              const keyring = new Keyring({ type: "sr25519" });
              const user = new User(keyring, answers.user);
              await Sudo.batchAsSudoFinalized(
                Assets.FinalizeTge(),
                Assets.initIssuance(),
                Assets.mintToken(
                  new BN(answers.tokenId),
                  user,
                  new BN(answers.amount),
                ),
              );
              console.log("Done");
              return app();
            },
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
            const result = JSON.parse(JSON.stringify(collators)).find(
              (x: { toString: () => string }) =>
                x.toString() === user.keyRingPair.address,
            );
            console.info(result?.toString());
            console.info(
              `Is collator selected? : ${
                result && result.toString()?.length > 0
              }`,
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
            },
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
                answers.targetAddress,
              );
              return app();
            },
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
          .then(async (answers: { str: unknown }) => {
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
        const pools = mga.query.getPools();
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
          .then(
            async (answers: {
              mgaBig: string;
              ratio: { toString: () => string };
              user: any;
            }) => {
              await initApi();
              const mgaBig = answers.mgaBig === "true";
              const ratio = parseInt(answers.ratio.toString());
              const user = answers.user;
              await createCustomPool(mgaBig, ratio, user);
              return app();
            },
          );
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
          .then(async (answers: { motion: number }) => {
            await initApi();
            await vetoMotion(answers.motion);
            return app();
          });
      }
      if (answers.option.includes("Who is offline")) {
        await printCandidatesNotProducing();
      }
      if (answers.option.includes("migrateData")) {
        await migrate();
      }
      if (answers.option.includes("testTokensForUsers")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "userPath",
              message: "//Eve",
            },
          ])
          .then(async (answers: { userPath: string }) => {
            await testTokensForUsers(answers.userPath);
          });
      }
      if (answers.option.includes("user aggregates with")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "userAggregating",
              message: "",
            },
            {
              type: "input",
              name: "userWhoDelegates",
              message: "",
            },
          ])
          .then(
            async (answers: {
              userAggregating: string;
              userWhoDelegates: string;
            }) => {
              await userAggregatesOn(
                answers.userAggregating,
                answers.userWhoDelegates,
              );
              console.log("Done");
              return app();
            },
          );
      }
      if (answers.option.includes("listen token balance changes")) {
        await subscribeAndPrintTokenChanges(
          getEnvironmentRequiredVars().chainUri,
        );
      }
      if (answers.option.includes("provisionWith100Users")) {
        await provisionWith100Users();
      }
      if (answers.option.includes("find and claim all rewards")) {
        await findAllRewardsAndClaim();
      }
      if (answers.option.includes("Create Proposal")) {
        await createProposal();
      }
      if (answers.option.includes("slibing")) {
        const EMPTY_U8A_32 = new Uint8Array(32);
        const ass = encodeAddress(
          u8aConcat(stringToU8a("para"), bnToU8a(2110), EMPTY_U8A_32).subarray(
            0,
            32,
          ),
        );
        console.log(ass);
      }
      if (answers.option.includes("rpc_chops")) {
        await replaceByStateCall();
      }
      if (answers.option.includes("proof crowdloan")) {
        const keyring = new Keyring({ type: "ed25519" });
        const relayAcc = keyring.addFromMnemonic("//Bob");
        const keyringMga = new Keyring({ type: "sr25519" });
        const accMga = keyringMga.addFromMnemonic("//Bob");
        const message = new Uint8Array([
          ...stringToU8a("<Bytes>"),
          ...stringToU8a("mangata-"),
          ...accMga.addressRaw,
          ...stringToU8a("</Bytes>"),
        ]);
        await initApi();
        await setupUsers();
        await setupApi();
        const api = await getApi();
        const signature = {
          Ed25519: relayAcc.sign(message),
        };
        const tx = Sudo.sudo(
          api.tx.crowdloan.associateNativeIdentity(
            accMga.address,
            relayAcc.address,
            signature,
          ),
        );
        await Sudo.batchAsSudoFinalized(tx);
        console.log(message.toString());
      }
      if (
        answers.option.includes(
          "Activate and claim 3rd party rewards to default users",
        )
      ) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "user",
              default: "//Charlie",
            },
          ])
          .then(async (answers: { user: string }) => {
            activateAndClaim3rdPartyRewardsForUser(answers.user);
            return app();
          });
      }
      if (
        answers.option.includes("Add activated 3rd party rewards liquidity")
      ) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "user",
              default: "//Alice",
            },
            {
              type: "input",
              name: "liqId",
              message: "liqId",
            },
            {
              type: "input",
              name: "rewardToken",
              message: "rewardToken",
            },
            {
              type: "input",
              name: "tokenValue",
              message: "tokenValue",
            },
          ])
          .then(
            async (answers: {
              user: string;
              liqId: string;
              rewardToken: string;
              tokenValue: string;
            }) => {
              addActivatedLiquidityFor3rdPartyRewards(
                new BN(answers.liqId.toString()),
                new BN(answers.rewardToken.toString()),
                new BN(answers.tokenValue.toString()),
                answers.user,
              );
              return app();
            },
          );
      }
      if (answers.option.includes("Add activated native rewards liquidity")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "user",
              message: "user",
              default: "//Alice",
            },
            {
              type: "input",
              name: "liqId",
              message: "liqId",
            },
            {
              type: "input",
              name: "tokenValue",
              message: "tokenValue",
            },
          ])
          .then(
            async (answers: {
              user: string;
              liqId: string;
              rewardToken: string;
              tokenValue: string;
            }) => {
              addActivatedLiquidityForNativeRewards(
                new BN(answers.liqId.toString()),
                new BN(answers.tokenValue.toString()),
                answers.user,
              );
              return app();
            },
          );
      }
      if (answers.option.includes("Staked liq that is not activated")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "liqId",
              message: "liquidity token ID",
              default: "1",
            },
          ])
          .then(async (answers: { liqId: number }) => {
            addStakedUnactivatedReserves(answers.liqId);
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

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
  getAllCollatorsInfoFromStash,
  addUnspentReserves,
  depositFromL1,
  withdrawToL1,
  signEthUserTxByMetamask,
  monitorRollDown,
  readL2Updates,
  depositHell,
  getPolkAddress,
  create10sequencers,
  closeL1Item,
  sendUpdateToL1,
  createSequencers,
  monitorSequencers,
  printAllSequencerUpdates,
  depositHellSustained,
  printAllSwapsFromPool,
} from "../utils/setupsOnTheGo";
import {
  findErrorMetadata,
  getEnvironmentRequiredVars,
  printCandidatePowers,
  swapEachNBlocks,
  Withdrawal,
  DepositWithdrawalRecord,
  Deposit,
  stringToBN,
} from "../utils/utils";
import { Node } from "../utils/Framework/Node/Node";
import { SudoUser } from "../utils/Framework/User/SudoUser";
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../utils/api";
import { User } from "../utils/User";
import { BN_ZERO, Mangata, signTx } from "gasp-sdk";
import { encodeAddress } from "@polkadot/keyring";
import { stringToU8a, bnToU8a, u8aConcat, BN } from "@polkadot/util";
import { Sudo } from "../utils/sudo";
import { setupApi, setupUsers } from "../utils/setup";
import { Assets } from "../utils/Assets";
import { toNumber } from "lodash-es";
import { L2Update, Rolldown } from "../utils/rollDown/Rolldown";
import inquirer from "inquirer";
import { getAssetIdFromErc20 } from "../utils/rollup/ethUtils";
import Redis from "ioredis-rejson";
import { L1Type } from "../utils/rollup/l1s";

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
        "Get All collators info from stash",
        "Add vesting tokens and move these to MPL",
        "Deposit tokens by using updateL2FromL1",
        "Withdraw tokens by using updateL2FromL1",
        "Sign Tx from ethUser by Metamask",
        "Read L2 updates",
        "RollDownMonitor",
        "depositHell",
        "SustainedDeposits",
        "getPolkAddress",
        "create10sequencers",
        "Close L1 item",
        "Close All L1 items",
        "1000 withdrawals",
        "sync updates",
        "add sequencers like hell",
        "monitor sequencers",
        "listExtrinsics",
        "Track deposit transaction",
        "Track withdrawal transaction",
        "printAllSwapsFromPool",
        "Create deposit with ferry",
        "Create withdrawal with ferry",
      ],
    })
    .then(async (answers: { option: string | string[] }) => {
      console.log("Answers::: " + JSON.stringify(answers, null, "  "));
      if (answers.option.includes("listExtrinsics")) {
        await printAllSequencerUpdates();
      }
      if (answers.option.includes("printAllSwapsFromPool")) {
        await printAllSwapsFromPool(0, 1740614400000);
      }

      if (answers.option.includes("add sequencers like hell")) {
        await createSequencers(1000);
      }
      if (answers.option.includes("monitor sequencers")) {
        await monitorSequencers();
      }
      if (answers.option.includes("sync updates")) {
        await sendUpdateToL1();
      }
      if (answers.option.includes("1000 withdrawals")) {
        const chain = "EthAnvil";
        const userAddress = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";
        const ethTokenAddress = "0x736ecc5237b31edec6f1ab9a396fae2416b1d96e";
        await setupApi();
        await setupUsers();
        const addr = ethTokenAddress;
        await Sudo.asSudoFinalized(
          Sudo.sudo(
            Assets.mintTokenAddress(
              await getAssetIdFromErc20(addr, chain),
              userAddress,
            ),
          ),
        );
        await Rolldown.createWithdrawalsInBatch(500, userAddress, addr, chain);
      }
      if (answers.option.includes("Close All L1 items")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "itemId",
              message: "From what itemId?",
            },
          ])
          .then(async (answers: { itemId: number }) => {
            await closeL1Item(
              BigInt(answers.itemId),
              "close_withdrawal",
              "Ethereum",
              true,
            );
          });
      }
      if (answers.option.includes("Close L1 item")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "itemId",
              message: "itemId",
            },
          ])
          .then(async (answers: { itemId: number }) => {
            await closeL1Item(BigInt(answers.itemId));
          });
      }
      if (answers.option.includes("create10sequencers")) {
        await inquirer
          .prompt([
            {
              type: "input",
              name: "network",
              message: "Eth? arb?",
              default: "Ethereum",
            },
          ])
          .then(async (answers: { network: string }) => {
            await create10sequencers(answers.network.toString());
            return;
          });
      }
      if (answers.option.includes("getPolkAddress")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "address",
              message: "Eth addresss",
              default: "",
            },
          ])
          .then(async (answers: { address: string }) => {
            const addr = await getPolkAddress(answers.address);
            console.info(addr);
          });
      }

      if (answers.option.includes("RollDownMonitor")) {
        await monitorRollDown("deposit");
      }
      if (answers.option.includes("depositHell")) {
        while (true) {
          await depositHell(5000);
        }
      }
      if (answers.option.includes("SustainedDeposits")) {
        while (true) {
          await depositHellSustained(5000);
        }
      }
      if (answers.option.includes("Read L2 updates")) {
        await readL2Updates();
      }
      if (answers.option.includes("Get All collators info from stash")) {
        await getAllCollatorsInfoFromStash();
      }
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
        await inquirer
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
            signature.toString(),
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
              name: "tokenAmount",
              message: "tokenAmount",
            },
          ])
          .then(
            async (answers: {
              user: string;
              liqId: string;
              rewardToken: string;
              tokenAmount: string;
            }) => {
              await addActivatedLiquidityFor3rdPartyRewards(
                new BN(answers.liqId.toString()),
                new BN(answers.rewardToken.toString()),
                new BN(answers.tokenAmount.toString()),
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
              await addActivatedLiquidityForNativeRewards(
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
              name: "user",
              message: "user",
              default: "//Alice",
            },
            {
              type: "input",
              name: "liqId",
              message: "liquidity token ID (1 - create new pool)",
              default: "1",
            },
          ])
          .then(async (answers: { user: string; liqId: number }) => {
            const liqIdBn = toNumber(answers.liqId.toString());
            await addStakedUnactivatedReserves(answers.user, liqIdBn);
            return app();
          });
      }
      if (answers.option.includes("Add vesting tokens and move these to MPL")) {
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
              message: "liquidity token ID (1 - create new pool)",
              default: "1",
            },
          ])
          .then(async (answers: { user: string; tokenId: number }) => {
            const tokenIdBn = toNumber(answers.tokenId.toString());
            await addUnspentReserves(answers.user, tokenIdBn);
            return app();
          });
      }
      if (answers.option.includes("Deposit tokens by using updateL2FromL1")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "ethAddress",
              message: "Ethereum address",
            },
            {
              type: "input",
              name: "amountValue",
              message: "amount",
            },
          ])
          .then(
            async (answers: {
              requestNumber: number;
              ethAddress: string;
              amountValue: number;
            }) => {
              await depositFromL1(answers.ethAddress, answers.amountValue);
              return app();
            },
          );
      }
      if (answers.option.includes("Withdraw tokens by using updateL2FromL1")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "ethPrivateKey",
              message: "Ethereum private key",
            },
            {
              type: "input",
              name: "amountValue",
              message: "amount",
            },
          ])
          .then(
            async (answers: { ethPrivateKey: string; amountValue: number }) => {
              await initApi();
              //await setupUsers();
              await setupApi();
              //await getApi();
              await withdrawToL1(answers.ethPrivateKey, answers.amountValue);
              return app();
            },
          );
      }
      if (answers.option.includes("Sign Tx from ethUser by Metamask")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "ethPrivateKey",
              message: "Ethereum private key",
            },
            {
              type: "input",
              name: "txHex",
              message: "Extrinsic hex",
            },
          ])
          .then(async (answers: { ethPrivateKey: string; txHex: string }) => {
            await initApi();
            await signEthUserTxByMetamask(answers.txHex, answers.ethPrivateKey);
            return app();
          });
      }
      if (answers.option.includes("Track deposit transaction")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "address",
              message: "Address",
            },
          ])
          .then(async (answers: { address: string }) => {
            const redis = new Redis({
              host: process.env.PROD_HOST,
              port: process.env.PROD_PORT,
              password: process.env.PROD_PASSWORD,
            });

            const keys = await redis.keys("deposits:*");
            if (!keys) {
              console.log('No data found for the key "deposits".');
              return app();
            }
            const deposits: DepositWithdrawalRecord[] = [];
            for (const key of keys) {
              if (key !== "deposits:index:hash") {
                const deposit = await redis.json_get(key);
                deposits.push({ key, data: deposit as Deposit });
              }
            }

            const res = deposits.filter(
              (r) =>
                r.data.address.toLowerCase() === answers.address.toLowerCase(),
            );
            console.log(res);

            await redis.quit();
            return app();
          });
      }
      if (answers.option.includes("Track withdrawal transaction")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "address",
              message: "Address",
            },
          ])
          .then(async (answers: { address: string }) => {
            const redis = new Redis({
              host: process.env.PROD_HOST,
              port: process.env.PROD_PORT,
              password: process.env.PROD_PASSWORD,
            });

            const keys = await redis.keys("withdrawals:*");
            if (!keys) {
              console.log('No data found for the key "withdrawals".');
              return app();
            }
            const withdrawals: DepositWithdrawalRecord[] = [];
            for (const key of keys) {
              if (key !== "withdrawals:index:hash") {
                const withdrawal = await redis.json_get(key);
                withdrawals.push({ key, data: withdrawal as Withdrawal });
              }
            }

            const res = withdrawals.filter(
              (r) =>
                r.data.address.toLowerCase() === answers.address.toLowerCase(),
            );

            console.log(res);

            await redis.quit();
            return app();
          });
      }
      if (answers.option.includes("Create deposit with ferry")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "chain",
              message: "Chain",
              default: "Ethereum",
            },
            {
              type: "input",
              name: "depositorAddress",
              message: "Depositor address",
            },
            {
              type: "input",
              name: "ferrierKey",
              message: "Ferrier private key",
            },
            {
              type: "input",
              name: "txIndex",
              message: "requestId index",
            },
            {
              type: "input",
              name: "tokenAddress",
              message: "ERC20 token address",
              default: "0xc351628eb244ec633d5f21fbd6621e1a683b1181",
            },
            {
              type: "input",
              name: "depositAmount",
              message: "Deposit amount",
            },
            {
              type: "input",
              name: "ferryTip",
              message: "Ferry tip",
            },
            {
              type: "input",
              name: "timestamp",
              message: "Timestamp",
              default: "0",
            },
          ])
          .then(
            async (answers: {
              chain: any;
              depositorAddress: string;
              ferrierKey: string;
              txIndex: number;
              tokenAddress: string;
              depositAmount: number;
              ferryTip: string;
              timestamp: number;
            }) => {
              await initApi();
              const api = await getApi();
              const keyring = new Keyring({ type: "ethereum" });
              const ferrier = new User(keyring, answers.ferrierKey);
              const depositUpdate = new L2Update(api)
                .withDeposit(
                  answers.txIndex,
                  answers.depositorAddress,
                  answers.tokenAddress,
                  answers.depositAmount,
                  answers.timestamp,
                  stringToBN(answers.ferryTip),
                )
                .on(answers.chain);
              const pendingDeposit = depositUpdate.pendingDeposits[0];
              await signTx(
                api,
                api.tx.rolldown.ferryDepositUnsafe(
                  answers.chain,
                  pendingDeposit.requestId,
                  pendingDeposit.depositRecipient,
                  pendingDeposit.tokenAddress,
                  pendingDeposit.amount,
                  pendingDeposit.timeStamp,
                  pendingDeposit.ferryTip,
                ),
                ferrier.keyRingPair,
              );
              return app();
            },
          );
      }
      if (answers.option.includes("Create withdrawal with ferry")) {
        return inquirer
          .prompt([
            {
              type: "input",
              name: "l1",
              message: "L1 Type",
              default: "EthAnvil",
            },
            {
              type: "input",
              name: "depositorAddress",
              message: "Depositor address",
            },
            {
              type: "input",
              name: "ferrierKey",
              message: "Ferrier private key",
            },
            {
              type: "input",
              name: "txIndex",
              message: "requestId index",
            },
            {
              type: "input",
              name: "tokenAddress",
              message: "ERC20 token address",
              default: "0xc351628eb244ec633d5f21fbd6621e1a683b1181",
            },
            {
              type: "input",
              name: "depositAmount",
              message: "Deposit amount",
            },
            {
              type: "input",
              name: "ferryTip",
              message: "Ferry tip",
            },
          ])
          .then(
            async (answers: {
              l1: L1Type;
              depositorAddress: string;
              ferrierKey: string;
              txIndex: number;
              tokenAddress: string;
              depositAmount: number;
              ferryTip: number;
            }) => {
              await initApi();
              const keyring = new Keyring({ type: "ethereum" });
              const ferrier = new User(keyring, answers.ferrierKey);
              await Rolldown.ferryWithdrawal(
                answers.l1,
                ferrier,
                answers.depositorAddress,
                answers.tokenAddress,
                answers.depositAmount,
                answers.ferryTip,
                {
                  origin: 1,
                  id: answers.txIndex,
                },
              );
              return app();
            },
          );
      }
      return app();
    });
}
/**
async function app(): Promise<any> {
  return inquirer
    .prompt({
      type: "list",
      message: "Select setup",
      name: "option",
      choices: ["Setup rewards with default users"],
    })
    .then(async (answers: { option: string | string[] }) => {
      if (answers.option.includes("Setup rewards with default users")) {
        await setupPoolWithRewardsForDefaultUsers();
        //await swapEachNBlocks(1);
        console.log("liq Id = ");
      }
    });
}
*/
const main = async () => {
  try {
    await app();
  } catch (e) {
    console.log(e);
  }
};
main();

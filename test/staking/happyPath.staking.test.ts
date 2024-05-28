/* eslint-disable no-console */
/*
 *
 * @group experimentalStaking
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import { User } from "../../utils/User";
import { Mangata } from "@mangata-finance/sdk";
import { setupUsers, setupApi, eve, alice } from "../../utils/setup";
import { Staking, tokenOriginEnum } from "../../utils/Staking";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { MGA_ASSET_ID } from "../../utils/Constants";
import {
  sleep,
  waitNewStakingRound,
  waitUntilCollatorProducesBlocks,
  waitUntilUserCollatorRewarded,
} from "../../utils/utils";
import { signSendAndWaitToFinishTx } from "../../utils/txHandler";
import "jest-extended";
import { Vesting } from "../../utils/Vesting";
import { MPL } from "../../utils/MPL";
import Docker from "dockerode";
import execSh from "exec-sh";
import { testLog } from "../../utils/Logger";
import { BN } from "@polkadot/util";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";
let docker: Docker;
const dockerImageName = "test_image:automation";
const mgaParachainImageName =
  "mangatasolutions/rollup-node:eth-rollup-develop-fast";
const mgaDockerContainerImage = "output-parachain-2110-1";

let testUser1: User;
let minStk: BN;
beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  docker = new Docker();
  [testUser1] = setupUsers();
  await setupApi();
  minStk = new BN(
    (await getApi()).consts.parachainStaking.minCandidateStk.toString(),
  );
  await waitUntilUserCollatorRewarded(alice);
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, minStk.muln(1000)),
    Assets.mintNative(eve, minStk.muln(1000)),
    Sudo.sudo(
      await Vesting.forceVested(testUser1, eve, minStk.muln(50), MGA_ASSET_ID),
    ),
    Sudo.sudoAs(
      eve,
      MPL.reserveVestingNativeTokensByVestingIndex(MGA_ASSET_ID),
    ),
    Assets.FinalizeTge(),
    Assets.initIssuance(),
  );
});

describe("HappyPath - staking - a collator producing blocks", () => {
  beforeEach(async () => {});
  it("A user that have plenty of vested tokens can be a collator", async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        eve,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          MGA_ASSET_ID,
          tokenOriginEnum.UnspentReserves,
        ),
      ),
    );
    await startDockerImage();
    await signNodeWithEve();
    await waitNewStakingRound(50);
    eve.addAsset(MGA_ASSET_ID);
    await waitUntilCollatorProducesBlocks(100, eve.keyRingPair.address);
    const elected = await Staking.isUserElected(eve.keyRingPair.address);
    await eve.refreshAmounts();
    await waitUntilUserCollatorRewarded(eve);
    expect(elected).toBeTruthy();
  });

  beforeEach(async () => {
    const containers = (await docker.listContainers()).filter((x) =>
      x.Image.includes(dockerImageName),
    );
    for (let index = 0; index < containers.length; index++) {
      const containerInfo = containers[index];
      await docker.getContainer(containerInfo.Id).remove({ force: true });
    }
    await sleep(5000);
  });

  afterEach(async () => {
    const containers = (await docker.listContainers()).filter((x) =>
      x.Image.includes(dockerImageName),
    );
    for (let index = 0; index < containers.length; index++) {
      const containerInfo = containers[index];
      await docker.getContainer(containerInfo.Id).remove({ force: true });
    }
    await sleep(5000);
  });
});
async function startDockerImage() {
  const as = await docker.listContainers();
  const bobImage = as.filter(
    (x) =>
      x.Command.toLowerCase().includes("baltathar") &&
      x.Image.includes(mgaParachainImageName),
  )[0];
  await execSh(`docker tag ${mgaDockerContainerImage} ${dockerImageName}`);
  await sleep(2000);
  const command = bobImage.Command;
  const commandReady = command
    .replace("/app/node", "")
    .replace("--baltathar", "--ethan");
  const sanitized = commandReady.split(" ").filter((x) => x.length !== 0);
  return docker.run(
    dockerImageName,
    sanitized,
    process.stdout,
    {
      name: "testImage_mangata_node",
      ExposedPorts: {
        "9615/tcp": {},
        "30334/tcp": {},
        "9944": {},
        "9933": {},
        "30333": {},
      },
      HostConfig: {
        AutoRemove: true,
        NetworkMode: "output_default",
        PortBindings: {
          "9944": [
            {
              HostPort: "0",
            },
          ],
          "9933": [
            {
              HostPort: "0", //Map container to a random unused port.
            },
          ],
          "30333": [
            {
              HostPort: "0", //Map container to a random unused port.
            },
          ],
        },
      },
    },
    function (err: any, data: { StatusCode: any }) {
      if (err) {
        testLog.getLog().error(err);
        return err;
      }
      testLog.getLog().error(data.StatusCode);
      return undefined;
    },
  );
}
async function signNodeWithEve() {
  await sleep(30000);
  const cont = await docker.listContainers();
  const newRunnCont = cont.filter((x) => x.Image.includes(dockerImageName))[0];
  const port = newRunnCont.Ports.filter((p) => p.PrivatePort === 9944)[0]
    .PublicPort;
  const eveNode = await Mangata.instance([`ws://127.0.0.1:${port}`]).api();
  const keys = await eveNode.rpc.author.rotateKeys();
  await signSendAndWaitToFinishTx(
    eveNode?.tx.session.setKeys(keys.toString(), "0x00"),
    eve.keyRingPair,
  );
}

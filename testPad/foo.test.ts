/* eslint-disable no-console */
import { getApi, initApi } from "../utils/api";
import Docker from "dockerode";
import execSh from "exec-sh";
import { sleep } from "../utils/utils";
import "dotenv/config";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let docker;
const dockerImageName = "test_image:automation";
const mgaParachainImageName = "parachain-2110";
const mgaDockerContainerImage = "output-parachain-2110-1";

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
  test.skip("docker thingy", async () => {
    docker = new Docker();
    const as = await docker.listContainers();
    const bobImage = as.filter(
      (x) =>
        x.Command.toLowerCase().includes("bob") &&
        x.Image.includes(mgaParachainImageName),
    )[0];
    await execSh(`docker tag ${mgaDockerContainerImage} ${dockerImageName}`);
    await sleep(2000);
    const command = bobImage.Command;
    const commandReady = command
      .replace("/mangata/node", "")
      .replace("--bob", "");
    const sanitized = commandReady.split(" ").filter((x) => x.length !== 0);
    docker.run(
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
      function (err, data) {
        if (err) {
          return console.error(err);
        }
        console.info(data.StatusCode);
      },
    );
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

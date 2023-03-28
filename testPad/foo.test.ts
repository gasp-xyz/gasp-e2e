/* eslint-disable no-console */
import { getApi, initApi } from "../utils/api";
import Docker from "dockerode";
import execSh from "exec-sh";
require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";

describe("staking - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
  let child;
  test.skip("docker thingy", async () => {
    const docker = new Docker();
    const as = await docker.listContainers();
    const aliceImage = as.filter(
      (x) =>
        x.Command.toLowerCase().includes("bob") &&
        x.Image.includes("parachain-2110")
    )[0];
    // const nw = docker.getNetwork(aliceImage.Id);
    await execSh("docker tag output-parachain-2110-1 foo:brum");
    const command = aliceImage.Command;
    const commandReady = command
      .replace("/mangata/node", "")
      .replace("--bob", "");
    // const sanitized = commandReady.split(" ").filter((x) => x.length !== 0);
    child = execSh(
      [
        "docker run  -p 30400:30333 -p 9950:9944 -p 9953:9933 --network=output_default foo:brum" +
          commandReady,
      ],
      true,
      (err, stdout, stderr) => {
        console.info("error: ", err);
        console.info("stdout: ", stdout);
        console.info("stderr: ", stderr);
      }
    );
    /***
    const p = docker.run("foo:brum", sanitized, process.stdout, {
      name: "my-python-container",
      ExposedPorts: {
        "9615/tcp": {},
        "30334/tcp": {},
        "9944": {},
        "9933": {},
        "30333": {},
      },
      HostConfig: {
        AutoRemove: true,
        Network: "output_default",
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
    });
    **/
    // console.info(JSON.stringify(as));
  });
  afterEach(async () => {
    child.exit();
  });
});

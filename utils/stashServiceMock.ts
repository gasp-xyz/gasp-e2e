import express, { Express } from "express";
import cors from "cors";
import axios from "axios";
import https from "https";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars } from "./utils";

const stashServiceMock: Express = express();
const port = 3000;
const localAddress = getEnvironmentRequiredVars().localAddress;
const stashServiceAddress = getEnvironmentRequiredVars().stashServiceAddress;

stashServiceMock.use(
  cors({
    origin: "*",
  })
);

stashServiceMock.get("/xcm/channels", (_req, res) => {
  const data = [
    {
      channelId: "1",
      name: "Kusama",
      status: "open",
      unitWeightCost: "",
      xcmTransferWeight: "298368000",
      url: "ws://" + localAddress + ":9944",
      xcmVersion: "V3",
      chainType: "relaychain",
    },
    {
      channelId: "1000",
      name: "Statemine",
      status: "open",
      unitWeightCost: "",
      xcmTransferWeight: "1171466000",
      url: "wss://statemine.api.onfinality.io/public-ws",
      xcmVersion: "V3",
      chainType: "parachain",
    },
    {
      channelId: "2001",
      name: "Bifrost",
      status: "open",
      unitWeightCost: "200000000",
      xcmTransferWeight: "800000000",
      url: "wss://bifrost-rpc.liebi.com/ws",
      xcmVersion: "V2",
      chainType: "parachain",
    },
    {
      channelId: "2023",
      name: "Moonriver",
      status: "open",
      unitWeightCost: "200000000",
      xcmTransferWeight: "800000000",
      url: "wss://wss.api.moonriver.moonbeam.network",
      xcmVersion: "V2",
      chainType: "parachain",
    },
    {
      channelId: "2114",
      name: "Turing",
      status: "open",
      unitWeightCost: "1000000000",
      xcmTransferWeight: "4000000000",
      url: "wss://rpc.turing.oak.tech",
      xcmVersion: "V3",
      chainType: "parachain",
    },
    {
      channelId: "2121",
      name: "Imbue",
      status: "open",
      unitWeightCost: "200000000",
      xcmTransferWeight: "800000000",
      url: "wss://imbue-kusama.imbue.network",
      xcmVersion: "V3",
      chainType: "parachain",
    },
  ];

  res.json(data);
});

stashServiceMock.use("/xcm", async (req, res) => {
  try {
    // Forward all xcm requests to the true service
    const response = await axios({
      method: req.method,
      url: stashServiceAddress + "/xcm" + req.url,
      data: req.body,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    testLog
      .getLog()
      .info("Error forwarding request to the real service:", error);
    res
      .status(500)
      .json({ error: "Failed to forward request to the true service" });
  }
});

stashServiceMock.listen(port, () => {
  testLog.getLog().info(`Server is running on port ${port}`);
});

export default stashServiceMock;

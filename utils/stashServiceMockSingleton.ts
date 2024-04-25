import express, { Express } from "express";
import cors from "cors";
import axios from "axios";
import https from "https";
import http from "http";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars } from "./utils";

const localAddress = getEnvironmentRequiredVars().localAddress;
const stashServiceAddress = getEnvironmentRequiredVars().stashServiceAddress;

class StashServiceMockSingleton {
  private static instance: StashServiceMockSingleton | null = null;
  private stashServiceMock: Express;
  private server: http.Server; // You can define the server variable here
  private readonly port = 3456; // Set the port number to 3456

  private constructor() {
    // Private constructor to prevent external instantiation
    this.stashServiceMock = express();

    this.stashServiceMock.use(
      cors({
        origin: "*",
      }),
    );

    this.stashServiceMock.get("/xcm/channels", (_req, res) => {
      const data = [
        {
          channelId: "1",
          name: "Kusama",
          status: "open",
          unitWeightCost: "",
          xcmTransferWeight: "500000000",
          url: "ws://" + localAddress + ":9944",
          xcmVersion: "V3",
          chainType: "relaychain",
          proofSize: "10000",
        },
        {
          channelId: "1000",
          name: "Statemine",
          status: "open",
          unitWeightCost: "",
          xcmTransferWeight: "1171466000",
          url: "ws://" + localAddress + ":9949",
          xcmVersion: "V3",
          chainType: "parachain",
          proofSize: "0",
        },
        {
          channelId: "2001",
          name: "Bifrost",
          status: "open",
          unitWeightCost: "200000000",
          xcmTransferWeight: "800000000",
          url: "ws://" + localAddress + ":9947",
          xcmVersion: "V2",
          chainType: "parachain",
          proofSize: "0",
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
          proofSize: "0",
        },
        {
          channelId: "2114",
          name: "Turing",
          status: "open",
          unitWeightCost: "1000000000",
          xcmTransferWeight: "4000000000",
          url: "ws://" + localAddress + ":9948",
          xcmVersion: "V3",
          chainType: "parachain",
          proofSize: "0",
        },
        {
          channelId: "2121",
          name: "Imbue",
          status: "open",
          unitWeightCost: "200000000",
          xcmTransferWeight: "800000000",
          url: "ws://" + localAddress + ":9951",
          xcmVersion: "V3",
          chainType: "parachain",
          proofSize: "4096",
        },
      ];

      res.json(data);
    });

    this.stashServiceMock.get("/token/order-buckets", (_req, res) => {
      const data = {
        buckets: [
          {
            bucket: "stables",
            rank: 1,
            tokens: ["USDT", "USDC", "aUSD"],
          },
          {
            bucket: "bluechips",
            rank: 2,
            tokens: ["BTC", "ETH"],
          },
          {
            bucket: "l0",
            rank: 3,
            tokens: ["DOT", "KSM"],
          },
          {
            bucket: "dextoken",
            rank: 4,
            tokens: ["MGA", "MGX"],
          },
          {
            bucket: "l1",
            rank: 5,
            tokens: ["MOVR", "BNC", "OAK", "TUR", "IMBU", "ZLK", "RMRK"],
          },
          {
            bucket: "l2",
            rank: 6,
            tokens: [],
          },
          {
            bucket: "protocols",
            rank: 7,
            tokens: [],
          },
          {
            bucket: "derivatives",
            rank: 8,
            tokens: ["vKSM", "vsKSM", "vMOVR", "vBNC"],
          },
        ],
      };

      res.json(data);
    });

    // Match catch-all routes
    this.stashServiceMock.use("/:path", async (req, res) => {
      try {
        const fullPath = "/" + req.params.path + req.url;

        // Forward the request to the true service
        const response = await axios({
          method: req.method,
          url: stashServiceAddress + fullPath,
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

    // Start the server automatically during the instantiation
    this.server = this.stashServiceMock.listen(this.port, () => {
      testLog.getLog().info(`Server is running on port ${this.port}`);
    });
  }

  public static getInstance(): StashServiceMockSingleton {
    if (!StashServiceMockSingleton.instance) {
      StashServiceMockSingleton.instance = new StashServiceMockSingleton();
    }
    return StashServiceMockSingleton.instance;
  }

  public startMock(): Express {
    return this.stashServiceMock;
  }

  // Add a method to stop the server:
  public stopServer(): void {
    if (this.server) {
      this.server.close();
      testLog.getLog().info("Server stopped.");
    }
  }
}

export default StashServiceMockSingleton;

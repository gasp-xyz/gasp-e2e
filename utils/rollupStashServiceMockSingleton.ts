import express, { Express } from "express";
import cors from "cors";
import axios from "axios";
import https from "https";
import http from "http";
import { testLog } from "./Logger";
import { getEnvironmentRequiredVars } from "./utils";

//const localAddress = getEnvironmentRequiredVars().localAddress;
const stashServiceAddress = getEnvironmentRequiredVars().stashServiceAddress;

class RollupStashServiceMockSingleton {
  private static instance: RollupStashServiceMockSingleton | null = null;
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

    this.stashServiceMock.get("/affirmed-network/list", (_req, res) => {
      const data = [
        {
          key: "Ethereum",
          name: "Holesky",
          chainId: "0x539",
          layer: 1,
          parentChainId: 1,
          explorerUrl: "https://eth-holesky.blockscout.com",
          rpcUrl: "https://evm-node-eth-frontend.gasp.xyz",
          nativeToken: {
            name: "Ethereum",
            decimals: "18",
            symbol: "ETH"
          },
          status: "APPROVED",
          rolldownContract: "0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650"
        },
        // {
        //   key: "Arbitrum",
        //   name: "Arbitrum",
        //   chainId: "0x539",
        //   layer: 2,
        //   parentChainId: 1,
        //   explorerUrl: "",
        //   rpcUrl: "https://evm-node-arb-frontend.gasp.xyz",
        //   nativeToken: {
        //     name: "SepoliaEthereum",
        //     decimals: "18",
        //     symbol: "SepoliaETH"
        //   },
        //   status: "APPROVED",
        //   rolldownContract: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
        // }
      ];

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

  public static getInstance(): RollupStashServiceMockSingleton {
    if (!RollupStashServiceMockSingleton.instance) {
      RollupStashServiceMockSingleton.instance = new RollupStashServiceMockSingleton();
    }
    return RollupStashServiceMockSingleton.instance;
  }

  public startMock(): Express {
    testLog.getLog().info(`Stash mock Server starting on port ${this.port}`);
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

export default RollupStashServiceMockSingleton;

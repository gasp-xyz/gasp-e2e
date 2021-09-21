import { ApiPromise } from "@polkadot/api";
import { NodeWorker } from "./workers/nodeWorker";

export { Name, Node };

type Name = string;

type Node = {
  name: Name;
  worker?: NodeWorker | null;
  api?: ApiPromise | null;
};

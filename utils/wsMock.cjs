const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 5678 });
const fs = require("fs");

let remoteWs = null;
let clients = [];

wss.on("connection", (ws) => {
  console.log("Client connected");
  clients.push(ws);
  const connection_index = clients.indexOf(ws);

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);

    try {
      const messageJson = JSON.parse(message);

      switch (messageJson.method) {
        case "rpc_methods":
          handleRpcMethods();
          break;
        case "xyk_get_burn_amount":
          handleGetBurnAmount(messageJson);
          break;
        case "xyk_calculate_rewards_amount":
          handleCalcRewards(messageJson);
          break;
        case "xyk_get_tradeable_tokens":
          handleTradableTokens(messageJson);
          break;
        case "xyk_get_liq_tokens_for_trading":
          handleTradableLiqTokens(messageJson);
          break;
        case "pos_calculate_3rdparty_rewards_all":
          handleCalcRewardsAll(messageJson);
          break;
        default:
          console.log("Unknown method:", messageJson.method);
          if (!remoteWs) {
            remoteWs = new WebSocket("ws://localhost:9946");
            remoteWs.on("open", () => {
              // Send the message to the remote server
              remoteWs.send(message);
            });
            remoteWs.on("message", (message) => {
              const resHeaders = {};
              if (message.headers) {
                Object.keys(message.headers).forEach((key) => {
                  resHeaders[key] = message.headers[key];
                });
              }
              resHeaders["Access-Control-Allow-Origin"] = "*";
              resHeaders["Access-Control-Expose-Headers"] = "*";
              clients.forEach((client) => {
                const response = message.toString();
                client.send(response, { headers: resHeaders });
              });
              console.log(
                `Received response: ${message} with headers: ${message.headers}`
              );
            });
            remoteWs.on("close", () => {
              console.log("Connection closed");
              clients.splice(connection_index);
              remoteWs = null;
            });
          } else {
            remoteWs.send(message);
          }
      }
    } catch (error) {
      console.log("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

function handleRpcMethods() {
  const rpcResponseJson = fs.readFileSync("rpc_methods_response.json", "utf8");
  console.log("Mocked response:", rpcResponseJson);
  clients.forEach((client) => {
    client.send(rpcResponseJson);
  });
}

function handleGetBurnAmount(messageJson) {
  const burnResponseJson = fs.readFileSync(
    "get_burn_amount_response.json",
    "utf8"
  );
  let burnResponseParsed = JSON.parse(burnResponseJson);
  burnResponseParsed.id = messageJson.id;
  let response = JSON.stringify(burnResponseParsed);
  console.log("Mocked response:", response);
  clients.forEach((client) => {
    client.send(response);
  });
}

function handleCalcRewards(messageJson) {
  const responseJson = fs.readFileSync(
    "calculate_rewards_amount_response.json",
    "utf8"
  );
  let responseParsed = JSON.parse(responseJson);
  responseParsed.id = messageJson.id;
  let response = JSON.stringify(responseParsed);
  console.log("Mocked response:", response);
  clients.forEach((client) => {
    client.send(response);
  });
}

function handleCalcRewardsAll(messageJson) {
  const responseJson = fs.readFileSync(
    "calculate_rewards_all_response.json",
    "utf8"
  );
  let responseParsed = JSON.parse(responseJson);
  responseParsed.id = messageJson.id;
  let response = JSON.stringify(responseParsed);
  console.log("Mocked response:", response);
  clients.forEach((client) => {
    client.send(response);
  });
}

function handleTradableTokens(messageJson) {
  const responseJson = fs.readFileSync(
    "get_tradeable_tokens_response.json",
    "utf8"
  );
  let responseParsed = JSON.parse(responseJson);
  responseParsed.id = messageJson.id;
  let response = JSON.stringify(responseParsed);
  console.log("Mocked response:", response);
  clients.forEach((client) => {
    client.send(response);
  });
}

function handleTradableLiqTokens(messageJson) {
  const responseJson = fs.readFileSync(
    "get_liq_tokens_for_trading_response.json",
    "utf8"
  );
  let responseParsed = JSON.parse(responseJson);
  responseParsed.id = messageJson.id;
  let response = JSON.stringify(responseParsed);
  console.log("Mocked response:", response);
  clients.forEach((client) => {
    client.send(response);
  });
}
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 5678 });
const fs = require("fs");

let remoteWs = null;
let clients = [];

wss.on("connection", (ws) => {
  console.log("Client connected");
  clients.push(ws);

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
    const headers = {};
    if (message.headers) {
      Object.keys(message.headers).forEach((key) => {
        headers[key] = message.headers[key];
      });
    }

    try {
      const messageJson = JSON.parse(message);

      switch (messageJson.method) {
        case "rpc_methods":
          const rpcResponseJson = fs.readFileSync(
            "rpc_methods_response.json",
            "utf8"
          );
          clients.forEach((client) => {
            client.send(rpcResponseJson);
          });
          break;
        case "xyk_get_burn_amount":
          const burnResponseJson = fs.readFileSync(
            "get_burn_amount_response.json",
            "utf8"
          );
          let burnResponseParsed = JSON.parse(burnResponseJson);
          burnResponseParsed.id = messageJson.id;
          clients.forEach((client) => {
            client.send(JSON.stringify(burnResponseParsed));
          });
          break;
        default:
          console.log("Unknown method:", messageJson.method);
          if (!remoteWs) {
            remoteWs = new WebSocket("ws://localhost:9946");
            remoteWs.on("open", () => {
              // Send the message to the remote server
              remoteWs.send(message, { headers });
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
            });
          } else {
            remoteWs.send(message, { headers });
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

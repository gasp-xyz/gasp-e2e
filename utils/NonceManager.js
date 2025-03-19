 
import ipc from "node-ipc";

ipc.config.id = "nonceManager";
ipc.config.retry = 1500;
ipc.config.silent = false;
ipc.config.sync = true;
let nonce = -1;
ipc.serve(function () {
  ipc.server.on("getNonce", (data, socket) => {
    console.info("serving nonce" + data.id + nonce);
    nonce = nonce + 1;
    ipc.server.emit(socket, "nonce-" + data.id, nonce);
  });
});
ipc.server.start();

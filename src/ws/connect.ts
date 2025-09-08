import { eventHandler } from "vinxi/http";
import { RadioConnection } from "../lib/radio";

const connections = new Map<string, RadioConnection>();

export default eventHandler({
  handler() {},
  websocket: {
    async open(peer) {
      console.log("connecting", peer.id);
      if (!peer.websocket.url) {
        peer.close(1008, "Missing connection parameters");
        return;
      }
      const url = new URL(peer.websocket.url);
      const host = url.searchParams.get("host");
      const port = url.searchParams.get("port");
      if (!host || !port) {
        peer.close(1008, "Missing connection parameters");
        return;
      }
      const portNum = parseInt(port, 10);
      if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
        peer.close(1008, "Invalid port number");
        return;
      }

      console.log("connecting", peer.id, `${host}:${portNum}`);
      const connection = new RadioConnection();
      connections.set(peer.id, connection);
      connection.on("tcp-message", (msg) => {
        peer.send(msg, { compress: false });
      });
      connection.on("udp-packet", (packet) => {
        peer.send(packet.data, { compress: false });
      });
      connection.on("error", (err) => {
        console.error("connection error:", err);
        peer.close(1011, "Connection error");
        connections.delete(peer.id);
      });
      await connection.connect({ host, port: portNum });
    },
    async message(peer, message) {
      const connection = connections.get(peer.id);
      connection?.sendCommand(message.toString());
    },
    async close(peer) {
      console.log("disconnecting", peer.id);
      const connection = connections.get(peer.id);
      if (connection) {
        await connection.disconnect();
        connections.delete(peer.id);
      }
    },
  },
});

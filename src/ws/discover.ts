import { eventHandler } from "vinxi/http";
import { UdpDiscovery } from "../lib/discovery";

let disco = new UdpDiscovery({ port: 4992, dualStack: true });
disco.on("close", () => {
  disco = new UdpDiscovery({ port: 4992, dualStack: true });
});

const subscriptions = new Map();

export default eventHandler({
  handler() {},
  websocket: {
    async open(peer) {
      console.log("subscribing", peer.id);
      const handler = ({ data }: { data: Buffer }) =>
        peer.send(data, { compress: false });
      subscriptions.set(peer.id, handler);
      disco.on("packet", handler);
      await disco.start();
    },
    async close(peer) {
      console.log("unsubscribing", peer.id);
      const handler = subscriptions.get(peer.id);
      if (handler) {
        disco.off("packet", handler);
        subscriptions.delete(peer.id);
      }
    },
  },
});

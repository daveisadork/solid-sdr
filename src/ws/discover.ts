import { eventHandler } from "vinxi/http";
import { UdpDiscovery } from "../lib/discovery";

const subscribers = new Map<string, any>();

const disco = new UdpDiscovery({
  port: 4992,
  dualStack: true,
});

disco.on("packet", (packet) => {
  const promiseArray = [];
  for (const peer of subscribers.values()) {
    promiseArray.push(
      new Promise<void>((resolve) => {
        peer.send(packet.data, { compress: false });
        resolve();
      }),
    );
  }
});

export default eventHandler({
  handler() {},
  websocket: {
    async open(peer) {
      console.log("subscribing", peer.id);
      subscribers.set(peer.id, peer);
      await disco.start();
    },
    async close(peer) {
      console.log("unsubscribing", peer.id);
      subscribers.delete(peer.id);
    },
  },
});

import { eventHandler } from "vinxi/http";
import { UdpDiscovery } from "../lib/discovery";

export default eventHandler({
  handler() {},
  websocket: {
    async open(peer) {
      console.log("subscribing", peer.id);
      const disco = new UdpDiscovery({
        port: 4992,
        dualStack: true,
      });
      peer.context.discovery = disco;
      const handler = ({ data }: { data: Buffer }) =>
        peer.send(data, { compress: false });
      peer.context.handler = handler;
      disco.on("packet", handler);
      await disco.start();
    },
    async close(peer) {
      console.log("unsubscribing", peer.id);
      const disco = peer.context.discovery as UdpDiscovery;
      disco.off("packet", peer.context.handler);
      await disco.stop();
      peer.context.discovery = null;
      peer.context.handler = null;
    },
  },
});

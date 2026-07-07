import { describe, expect, it } from "vitest";
import { FlexCommandRejectedError } from "../../src/flex/errors.js";
import { FlexClient } from "../../src/flex/flex-client.js";
import { MockFlexTransport } from "../helpers.js";

describe("FlexClient", () => {
  it("disconnects a GUI client over a transient TCP command connection", async () => {
    const transport = new MockFlexTransport();
    const client = new FlexClient({ transport });

    await client.disconnectClient(
      { host: "192.168.1.100", port: 4992 },
      0x29dd2cdc,
    );

    expect(transport.connections).toHaveLength(1);
    expect(transport.connections[0]?.commands).toEqual([
      "client disconnect 0x29DD2CDC",
    ]);
  });

  it("surfaces disconnect command rejections", async () => {
    const transport = new MockFlexTransport();
    const client = new FlexClient({ transport });
    transport.prepareNextConnection((connection) => {
      connection.prepareResponse("client disconnect", {
        code: 0x50000092,
        message: "Client disconnected by another client",
      });
    });

    await expect(
      client.disconnectClient(
        { host: "192.168.1.100", port: 4992 },
        "0x29DD2CDC",
      ),
    ).rejects.toBeInstanceOf(FlexCommandRejectedError);

    expect(transport.connections).toHaveLength(1);
    expect(transport.connections[0]?.commands).toEqual([
      "client disconnect 0x29DD2CDC",
    ]);
  });
});

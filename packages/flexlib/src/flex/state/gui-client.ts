import type { BaseGuiClientInfo } from "../gui-client.js";
import type { Mutable, SnapshotUpdate } from "./common.js";
import { freezeAttributes, isTruthy, parseIntegerHex } from "./common.js";

export interface GuiClientSnapshot extends BaseGuiClientInfo {
  readonly id: string;
  readonly clientId?: string;
  readonly isThisClient: boolean;
  readonly transmitSliceId?: string;
  readonly raw: Readonly<Record<string, string>>;
}

export interface GuiClientSnapshotOptions {
  readonly localClientHandle?: number;
  readonly available?: boolean;
}

export function createGuiClientSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous: GuiClientSnapshot | undefined,
  options: GuiClientSnapshotOptions = {},
): SnapshotUpdate<GuiClientSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<GuiClientSnapshot>> = {};
  const clientHandle = parseIntegerHex(id) ?? previous?.clientHandle ?? 0;
  const clientIdToken = attributes["client_id"];
  if (clientIdToken !== undefined) {
    const trimmed = clientIdToken.trim();
    partial.clientId = trimmed.length > 0 ? trimmed : undefined;
  }
  if (attributes["program"] !== undefined) {
    const trimmed = attributes["program"].trim();
    partial.program = trimmed.length > 0 ? trimmed : undefined;
  }
  if (attributes["station"] !== undefined) {
    const normalized = attributes["station"].replace(/\u007f/g, " ").trim();
    partial.station = normalized.length > 0 ? normalized : undefined;
  }
  if (attributes["local_ptt"] !== undefined) {
    partial.isLocalPtt = isTruthy(attributes["local_ptt"]);
  }

  const snapshot: GuiClientSnapshot = Object.freeze({
    id,
    clientHandle,
    clientId: partial.clientId ?? previous?.clientId,
    program: partial.program ?? previous?.program,
    station: partial.station ?? previous?.station,
    isLocalPtt: partial.isLocalPtt ?? previous?.isLocalPtt ?? false,
    isAvailable: options.available ?? previous?.isAvailable ?? true,
    isThisClient:
      options.localClientHandle !== undefined &&
      clientHandle === options.localClientHandle,
    transmitSliceId: previous?.transmitSliceId,
    raw: rawDiff,
  });

  const diff: Mutable<Partial<Omit<GuiClientSnapshot, "raw">>> = {};
  if (!previous || previous.clientHandle !== snapshot.clientHandle) {
    diff.clientHandle = snapshot.clientHandle;
  }
  if (!previous || previous.clientId !== snapshot.clientId) {
    diff.clientId = snapshot.clientId;
  }
  if (!previous || previous.program !== snapshot.program) {
    diff.program = snapshot.program;
  }
  if (!previous || previous.station !== snapshot.station) {
    diff.station = snapshot.station;
  }
  if (!previous || previous.isLocalPtt !== snapshot.isLocalPtt) {
    diff.isLocalPtt = snapshot.isLocalPtt;
  }
  if (!previous || previous.isAvailable !== snapshot.isAvailable) {
    diff.isAvailable = snapshot.isAvailable;
  }
  if (!previous || previous.isThisClient !== snapshot.isThisClient) {
    diff.isThisClient = snapshot.isThisClient;
  }

  return {
    snapshot,
    diff: Object.freeze(diff),
    rawDiff,
  };
}

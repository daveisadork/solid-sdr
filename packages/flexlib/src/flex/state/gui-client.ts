import type { BaseGuiClientInfo } from "../gui-client.js";
import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseIntegerHex,
} from "./common.js";

export interface GuiClientSnapshot extends BaseGuiClientInfo {
  readonly id: string;
  readonly clientId?: string;
  readonly isThisClient: boolean;
  readonly transmitSliceId?: string;
  readonly raw: Readonly<Record<string, string>>;
}

export interface GuiClientSnapshotOptions {
  readonly localClientHandle?: number;
}

const createIntitialSnapshot = (
  id: string,
  localClientHandle?: number,
): Partial<GuiClientSnapshot> => {
  const clientHandle = parseIntegerHex(id);
  if (clientHandle === undefined) {
    logParseError("client", "id", id);
  }
  return {
    id,
    clientHandleInt: clientHandle,
    isThisClient:
      clientHandle !== undefined && clientHandle === localClientHandle,
  };
};

export function createGuiClientSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous: GuiClientSnapshot | undefined,
  options: GuiClientSnapshotOptions = {},
): SnapshotUpdate<GuiClientSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<GuiClientSnapshot>> = previous
    ? {}
    : createIntitialSnapshot(id, options.localClientHandle);

  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "client_id": {
        const trimmed = value.trim();
        partial.clientId = trimmed.length > 0 ? trimmed : undefined;
        break;
      }
      case "program": {
        const trimmed = value.trim();
        partial.program = trimmed.length > 0 ? trimmed : undefined;
        break;
      }
      case "station": {
        const normalized = value.replace(/\u007f/g, " ").trim();
        partial.station = normalized.length > 0 ? normalized : undefined;
        break;
      }
      case "local_ptt":
        partial.isLocalPtt = isTruthy(value);
        break;
      default:
        logUnknownAttribute("client", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as GuiClientSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

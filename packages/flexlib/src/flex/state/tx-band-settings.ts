import type { Mutable, SnapshotUpdate } from "./common.js";
import {
  freezeAttributes,
  isTruthy,
  logParseError,
  logUnknownAttribute,
  parseInteger,
} from "./common.js";

export interface TxBandSettingSnapshot {
  readonly id: string;
  readonly bandName?: string;
  readonly hwAlcEnabled?: boolean;
  readonly tunePower?: number;
  readonly rfPower?: number;
  readonly pttInhibit?: boolean;
  readonly accTxReqEnabled?: boolean;
  readonly rcaTxReqEnabled?: boolean;
  readonly accTxEnabled?: boolean;
  readonly rcaTx1Enabled?: boolean;
  readonly rcaTx2Enabled?: boolean;
  readonly rcaTx3Enabled?: boolean;
  readonly raw: Readonly<Record<string, string>>;
}

export function createTxBandSettingSnapshot(
  id: string,
  attributes: Record<string, string>,
  previous?: TxBandSettingSnapshot,
): SnapshotUpdate<TxBandSettingSnapshot> {
  const rawDiff = freezeAttributes(attributes);
  const partial: Mutable<Partial<TxBandSettingSnapshot>> = previous
    ? {}
    : { id };
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case "band_id":
        break;
      case "band_name":
        partial.bandName = value;
        break;
      case "hwalc_enabled":
        partial.hwAlcEnabled = isTruthy(value);
        break;
      case "tunepower":
        partial.tunePower = parsePower(value, "tunepower");
        break;
      case "rfpower":
        partial.rfPower = parsePower(value, "rfpower");
        break;
      case "inhibit":
        partial.pttInhibit = isTruthy(value);
        break;
      case "acc_txreq_enable":
        partial.accTxReqEnabled = isTruthy(value);
        break;
      case "rca_txreq_enable":
        partial.rcaTxReqEnabled = isTruthy(value);
        break;
      case "acc_tx_enabled":
        partial.accTxEnabled = isTruthy(value);
        break;
      case "tx1_enabled":
        partial.rcaTx1Enabled = isTruthy(value);
        break;
      case "tx2_enabled":
        partial.rcaTx2Enabled = isTruthy(value);
        break;
      case "tx3_enabled":
        partial.rcaTx3Enabled = isTruthy(value);
        break;
      default:
        logUnknownAttribute("tx_band", key, value);
        break;
    }
  }

  const snapshot = Object.freeze({
    ...(previous ?? {}),
    ...partial,
    id,
    raw: Object.freeze({
      ...previous?.raw,
      ...attributes,
    }),
  }) as TxBandSettingSnapshot;

  return {
    snapshot,
    diff: Object.freeze(partial),
    rawDiff,
  };
}

function parsePower(
  value: string | undefined,
  key: string,
): number | undefined {
  const parsed = parseInteger(value);
  if (parsed === undefined) {
    if (value !== undefined) logParseError("tx_band", key, value);
    return undefined;
  }
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
}

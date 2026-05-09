import type { RadioNetworkDiagnosticsSnapshot } from "@repo/flexlib";

const LOSS_WINDOW_MS = 5_000;
const QUALITY_RECOVERY_COUNTDOWN = 5;
const QUALITY_FAIR_RTT_MS = 100;
const QUALITY_POOR_RTT_MS = 500;
const QUALITY_NORMAL_LOSS_PERCENT = 2;
const QUALITY_DEGRADED_LOSS_PERCENT = 5;

export type NetworkQuality =
  | "off"
  | "excellent"
  | "veryGood"
  | "good"
  | "fair"
  | "poor";

export interface RuntimeNetworkHopState {
  currentMs: number | null;
  maxMs: number | null;
  updatedAt: number | null;
}

export interface RuntimeNetworkBrowserState extends RuntimeNetworkHopState {
  rxKbps: number | null;
  txKbps: number | null;
}

export interface RuntimeNetworkCounters {
  totalPackets: number;
  lostPackets: number;
  lossPercent: number;
}

export interface RuntimeNetworkOverallState extends RuntimeNetworkCounters {
  quality: NetworkQuality;
  recent: RuntimeNetworkCounters;
}

export interface RuntimeNetworkState {
  overall: RuntimeNetworkOverallState;
  browserToServer: RuntimeNetworkBrowserState;
  serverToRadio: RuntimeNetworkHopState;
  endToEnd: RuntimeNetworkHopState;
}

export interface ServerNetworkDiagnosticsPayload {
  serverToRadioRttMs: number | null;
  serverToRadioRttMaxMs: number | null;
  sampledAt: number;
}

interface BrowserRtcSample {
  currentRttMs: number | null;
  rxBytes: number | null;
  txBytes: number | null;
  inboundAudioReceived: number | null;
  inboundAudioLost: number | null;
}

interface BrowserRateSample {
  at: number;
  rxBytes: number;
  txBytes: number;
}

interface LossSnapshot {
  totalPackets: number;
  lostPackets: number;
}

interface LossHistoryEntry extends LossSnapshot {
  at: number;
}

interface QualityReducerState {
  quality: NetworkQuality;
  countdown: number;
}

const EMPTY_HOP: RuntimeNetworkHopState = {
  currentMs: null,
  maxMs: null,
  updatedAt: null,
};

const EMPTY_BROWSER: RuntimeNetworkBrowserState = {
  ...EMPTY_HOP,
  rxKbps: null,
  txKbps: null,
};

const EMPTY_LOSS: LossSnapshot = {
  totalPackets: 0,
  lostPackets: 0,
};

const INITIAL_QUALITY: QualityReducerState = {
  quality: "off",
  countdown: QUALITY_RECOVERY_COUNTDOWN,
};

export function networkQualityLabel(quality: NetworkQuality): string {
  switch (quality) {
    case "excellent":
      return "Excellent";
    case "veryGood":
      return "Very Good";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return "Off";
  }
}

export function createInitialNetworkState(): RuntimeNetworkState {
  return {
    overall: {
      ...toCounters(EMPTY_LOSS),
      quality: "off",
      recent: toCounters(EMPTY_LOSS),
    },
    browserToServer: { ...EMPTY_BROWSER },
    serverToRadio: { ...EMPTY_HOP },
    endToEnd: { ...EMPTY_HOP },
  };
}

export function extractBrowserRtcSample(
  report: RTCStatsReport,
): BrowserRtcSample {
  let selectedPair: RTCIceCandidatePairStats | null = null;
  let selectedTransport: RTCTransportStats | null = null;
  let inboundAudioReceived = 0;
  let inboundAudioLost = 0;
  let hasAudio = false;

  for (const stat of report.values()) {
    if (
      stat.type === "transport" &&
      "selectedCandidatePairId" in stat &&
      stat.selectedCandidatePairId
    ) {
      selectedTransport = stat as RTCTransportStats;
      const pair = report.get(stat.selectedCandidatePairId);
      if (pair?.type === "candidate-pair") {
        selectedPair = pair as RTCIceCandidatePairStats;
      }
      continue;
    }

    if (
      stat.type === "candidate-pair" &&
      !selectedPair &&
      (stat as RTCIceCandidatePairStats).state === "succeeded" &&
      (stat as RTCIceCandidatePairStats).nominated
    ) {
      selectedPair = stat as RTCIceCandidatePairStats;
      continue;
    }

    if (
      stat.type === "inbound-rtp" &&
      (stat as RTCInboundRtpStreamStats).kind === "audio" &&
      !(stat as RTCInboundRtpStreamStats & { isRemote?: boolean }).isRemote
    ) {
      const inbound = stat as RTCInboundRtpStreamStats;
      inboundAudioReceived += inbound.packetsReceived ?? 0;
      inboundAudioLost += inbound.packetsLost ?? 0;
      hasAudio = true;
    }
  }

  return {
    currentRttMs:
      selectedPair?.currentRoundTripTime != null
        ? Math.round(selectedPair.currentRoundTripTime * 1_000)
        : null,
    rxBytes:
      selectedTransport?.bytesReceived ?? selectedPair?.bytesReceived ?? null,
    txBytes: selectedTransport?.bytesSent ?? selectedPair?.bytesSent ?? null,
    inboundAudioReceived: hasAudio ? inboundAudioReceived : null,
    inboundAudioLost: hasAudio ? inboundAudioLost : null,
  };
}

export class NetworkTelemetryAggregator {
  private browserToServer: RuntimeNetworkBrowserState = { ...EMPTY_BROWSER };
  private serverToRadio: RuntimeNetworkHopState = { ...EMPTY_HOP };
  private endToEnd: RuntimeNetworkHopState = { ...EMPTY_HOP };
  private radioLoss: LossSnapshot = { ...EMPTY_LOSS };
  private audioLoss: LossSnapshot = { ...EMPTY_LOSS };
  private browserRateSample: BrowserRateSample | null = null;
  private lossHistory: LossHistoryEntry[] = [];
  private quality = { ...INITIAL_QUALITY };

  reset(): RuntimeNetworkState {
    this.browserToServer = { ...EMPTY_BROWSER };
    this.serverToRadio = { ...EMPTY_HOP };
    this.endToEnd = { ...EMPTY_HOP };
    this.radioLoss = { ...EMPTY_LOSS };
    this.audioLoss = { ...EMPTY_LOSS };
    this.browserRateSample = null;
    this.lossHistory = [];
    this.quality = { ...INITIAL_QUALITY };
    return this.snapshot();
  }

  snapshot(): RuntimeNetworkState {
    const total = sumLoss(this.radioLoss, this.audioLoss);
    const recent = deriveRecentLoss(this.lossHistory);
    return {
      overall: {
        ...toCounters(total),
        quality: this.quality.quality,
        recent: toCounters(recent),
      },
      browserToServer: { ...this.browserToServer },
      serverToRadio: { ...this.serverToRadio },
      endToEnd: { ...this.endToEnd },
    };
  }

  updateRadioLoss(
    snapshot: RadioNetworkDiagnosticsSnapshot,
    sampledAt = Date.now(),
  ): RuntimeNetworkState {
    this.radioLoss = {
      totalPackets: snapshot.totalPackets,
      lostPackets: snapshot.lostPackets,
    };
    return this.commit(sampledAt);
  }

  updateRtcReport(
    report: RTCStatsReport,
    sampledAt = Date.now(),
  ): RuntimeNetworkState {
    const sample = extractBrowserRtcSample(report);

    this.browserToServer = {
      currentMs: sample.currentRttMs,
      maxMs: maxNullable(this.browserToServer.maxMs, sample.currentRttMs),
      updatedAt: sampledAt,
      rxKbps: null,
      txKbps: null,
    };

    if (
      sample.rxBytes != null &&
      sample.txBytes != null &&
      this.browserRateSample &&
      sampledAt > this.browserRateSample.at
    ) {
      const dtMs = sampledAt - this.browserRateSample.at;
      this.browserToServer.rxKbps = Math.max(
        0,
        ((sample.rxBytes - this.browserRateSample.rxBytes) * 8) / dtMs,
      );
      this.browserToServer.txKbps = Math.max(
        0,
        ((sample.txBytes - this.browserRateSample.txBytes) * 8) / dtMs,
      );
    }

    if (sample.rxBytes != null && sample.txBytes != null) {
      this.browserRateSample = {
        at: sampledAt,
        rxBytes: sample.rxBytes,
        txBytes: sample.txBytes,
      };
    }

    if (
      sample.inboundAudioReceived != null &&
      sample.inboundAudioLost != null
    ) {
      this.audioLoss = {
        totalPackets: sample.inboundAudioReceived + sample.inboundAudioLost,
        lostPackets: sample.inboundAudioLost,
      };
    }

    return this.commit(sampledAt);
  }

  updateServerDiagnostics(
    payload: ServerNetworkDiagnosticsPayload,
  ): RuntimeNetworkState {
    this.serverToRadio = {
      currentMs: payload.serverToRadioRttMs,
      maxMs: payload.serverToRadioRttMaxMs,
      updatedAt: payload.sampledAt,
    };
    return this.snapshot();
  }

  updateEndToEndRtt(
    currentMs: number,
    sampledAt = Date.now(),
  ): RuntimeNetworkState {
    this.endToEnd = {
      currentMs,
      maxMs: maxNullable(this.endToEnd.maxMs, currentMs),
      updatedAt: sampledAt,
    };
    return this.commit(sampledAt);
  }

  private commit(sampledAt: number): RuntimeNetworkState {
    const total = sumLoss(this.radioLoss, this.audioLoss);
    this.lossHistory = pushLossHistory(this.lossHistory, {
      at: sampledAt,
      ...total,
    });

    const recent = deriveRecentLoss(this.lossHistory);
    this.quality = reduceQuality(
      this.quality,
      this.endToEnd.currentMs,
      toLossPercent(recent),
      total.totalPackets,
    );

    return this.snapshot();
  }
}

function toCounters(loss: LossSnapshot): RuntimeNetworkCounters {
  return {
    totalPackets: loss.totalPackets,
    lostPackets: loss.lostPackets,
    lossPercent: toLossPercent(loss),
  };
}

function toLossPercent(loss: LossSnapshot): number {
  return loss.totalPackets > 0
    ? (loss.lostPackets * 100) / loss.totalPackets
    : 0;
}

function sumLoss(...parts: LossSnapshot[]): LossSnapshot {
  return parts.reduce(
    (sum, part) => ({
      totalPackets: sum.totalPackets + part.totalPackets,
      lostPackets: sum.lostPackets + part.lostPackets,
    }),
    { ...EMPTY_LOSS },
  );
}

function maxNullable(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null {
  if (left == null) return right ?? null;
  if (right == null) return left;
  return Math.max(left, right);
}

function pushLossHistory(
  history: LossHistoryEntry[],
  next: LossHistoryEntry,
): LossHistoryEntry[] {
  const deduped = history.filter(
    (entry) =>
      entry.totalPackets !== next.totalPackets ||
      entry.lostPackets !== next.lostPackets,
  );
  deduped.push(next);
  return deduped.filter((entry) => entry.at >= next.at - LOSS_WINDOW_MS);
}

function deriveRecentLoss(history: LossHistoryEntry[]): LossSnapshot {
  if (history.length === 0) {
    return EMPTY_LOSS;
  }

  const earliest = history[0];
  const latest = history[history.length - 1];
  return {
    totalPackets: Math.max(0, latest.totalPackets - earliest.totalPackets),
    lostPackets: Math.max(0, latest.lostPackets - earliest.lostPackets),
  };
}

function reduceQuality(
  state: QualityReducerState,
  endToEndRttMs: number | null,
  recentLossPercent: number,
  totalPackets: number,
): QualityReducerState {
  if (endToEndRttMs == null && totalPackets === 0) {
    return { ...INITIAL_QUALITY };
  }

  const next = { ...state };
  const packetLost =
    recentLossPercent >
    (state.quality === "fair" || state.quality === "poor"
      ? QUALITY_DEGRADED_LOSS_PERCENT
      : QUALITY_NORMAL_LOSS_PERCENT);

  switch (state.quality) {
    case "off":
      next.quality = "poor";
      next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      break;
    case "excellent":
      if (endToEndRttMs != null && endToEndRttMs >= QUALITY_POOR_RTT_MS) {
        next.quality = "poor";
      } else if (
        endToEndRttMs != null &&
        endToEndRttMs >= QUALITY_FAIR_RTT_MS
      ) {
        next.quality = "good";
      } else if (packetLost) {
        next.quality = "veryGood";
      }
      break;
    case "veryGood":
      if (endToEndRttMs != null && endToEndRttMs >= QUALITY_POOR_RTT_MS) {
        next.quality = "poor";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      } else if (
        (endToEndRttMs != null && endToEndRttMs >= QUALITY_FAIR_RTT_MS) ||
        packetLost
      ) {
        next.quality = "good";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      } else if (next.countdown-- <= 0) {
        next.quality = "excellent";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      }
      break;
    case "good":
      if (endToEndRttMs != null && endToEndRttMs >= QUALITY_POOR_RTT_MS) {
        next.quality = "poor";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      } else if (packetLost) {
        next.quality = "fair";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      } else if (
        (endToEndRttMs == null || endToEndRttMs < QUALITY_FAIR_RTT_MS) &&
        recentLossPercent <= QUALITY_NORMAL_LOSS_PERCENT &&
        next.countdown-- <= 0
      ) {
        next.quality = "veryGood";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      }
      break;
    case "fair":
      if (
        (endToEndRttMs != null && endToEndRttMs >= QUALITY_POOR_RTT_MS) ||
        packetLost
      ) {
        next.quality = "poor";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      } else if (next.countdown-- <= 0) {
        next.quality = "good";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      }
      break;
    case "poor":
      if (
        (endToEndRttMs == null || endToEndRttMs < QUALITY_POOR_RTT_MS) &&
        recentLossPercent <= QUALITY_DEGRADED_LOSS_PERCENT &&
        next.countdown-- <= 0
      ) {
        next.quality = "fair";
        next.countdown = QUALITY_RECOVERY_COUNTDOWN;
      }
      break;
  }

  return next;
}

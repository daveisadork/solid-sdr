export interface RadioNetworkDiagnosticsSnapshot {
  readonly totalPackets: number;
  readonly lostPackets: number;
  readonly lossPercent: number;
  readonly updatedAt: number | null;
}

export class RadioNetworkDiagnosticsTracker {
  private totalPackets = 0;
  private lostPackets = 0;
  private updatedAt: number | null = null;
  private readonly lastPacketCountBySource = new Map<string, number>();

  recordMeterPacket(packetCount: number, now = Date.now()): boolean {
    return this.recordPacket("meter", packetCount, now);
  }

  recordStreamPacket(
    streamId: number,
    packetCount: number,
    now = Date.now(),
  ): boolean {
    return this.recordPacket(`stream:${streamId}`, packetCount, now);
  }

  snapshot(): RadioNetworkDiagnosticsSnapshot {
    return {
      totalPackets: this.totalPackets,
      lostPackets: this.lostPackets,
      lossPercent:
        this.totalPackets > 0
          ? (this.lostPackets * 100) / this.totalPackets
          : 0,
      updatedAt: this.updatedAt,
    };
  }

  reset(): void {
    this.totalPackets = 0;
    this.lostPackets = 0;
    this.updatedAt = null;
    this.lastPacketCountBySource.clear();
  }

  private recordPacket(
    source: string,
    packetCount: number,
    now: number,
  ): boolean {
    const normalizedCount = packetCount & 0x0f;
    const previous = this.lastPacketCountBySource.get(source);

    this.totalPackets += 1;
    this.updatedAt = now;
    this.lastPacketCountBySource.set(source, normalizedCount);

    if (previous === undefined) {
      return false;
    }

    const expected = (previous + 1) & 0x0f;
    if (normalizedCount === expected) {
      return false;
    }

    this.lostPackets += 1;
    return true;
  }
}

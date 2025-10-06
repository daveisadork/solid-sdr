package rtc

import (
	"encoding/binary"
	"errors"
	"fmt"
)

var errShort = errors.New("vita: truncated packet")

// vitaView is the minimal view your demux needs.
// (Matches your AS fields; we keep just what we use.)
type vitaView struct {
	// From header
	TSI        uint8
	TSF        uint8
	HasClassID bool
	HasTrailer bool

	// Optionals
	StreamID  uint32
	OUI       uint32
	ClassInfo uint16
	ClassCode uint16

	// Timestamps (as in your AS impl; only frac LSB is kept)
	IntegerTimestamp    uint32
	FractionalTimestamp uint32

	// Raw payload slice
	Payload []byte
}

// parseVITA is a direct port of your AssemblyScript parseVita().
// Notes:
//   - All multi-byte reads are BIG-ENDIAN (DataView default, littleEndian=false).
//   - We DO NOT trust header packet_size. We use the actual datagram length.
//   - We ALWAYS read a StreamID (like your AS: “assumed present”).
//   - If trailerPresent, we reserve the last 4 bytes as trailer.
//   - Fractional timestamp: only the low 32 bits are kept (LSB), same as your AS.
func parseVITA(b []byte) (vitaView, error) {
	const (
		kVitaMinimumBytes     = 28
		kClassIdPresentMask   = 0x08
		kTrailerPresentMask   = 0x04
		kTsiTypeMask          = 0xC0
		kTsfTypeMask          = 0x30
		kOffsetOptionalsBytes = 4
		kTrailerSize          = 4
	)

	if len(b) < kVitaMinimumBytes {
		return vitaView{}, errShort
	}

	// Header bytes (big-endian fields, but we only need the flags/TSI/TSF)
	packetDesc := b[0]
	timeStampDesc := b[1]
	packetSizeBytes := len(b) // actual datagram length (ignore header packet_size)

	// Restrict logical end if trailer is present
	classIdPresent := (packetDesc & kClassIdPresentMask) != 0
	trailerPresent := (packetDesc & kTrailerPresentMask) != 0
	tsiType := (timeStampDesc & kTsiTypeMask) >> 6
	tsfType := (timeStampDesc & kTsfTypeMask) >> 4

	// We’ll walk “optional words” starting after the first 32-bit header word.
	optWordIndex := 0

	// ---- Stream ID (assumed present) ----
	off := kOffsetOptionalsBytes + (optWordIndex << 2)
	if off+4 > packetSizeBytes {
		return vitaView{}, errShort
	}
	streamID := binary.BigEndian.Uint32(b[off : off+4])
	optWordIndex++

	// ---- Class ID (if present) ----
	var classWord1 uint32
	var infoCode uint16
	var pktClass uint16
	var oui uint32

	if classIdPresent {
		off0 := kOffsetOptionalsBytes + (optWordIndex << 2)
		off1 := off0 + 4
		if off1+4 > packetSizeBytes {
			return vitaView{}, errShort
		}
		// Big-endian, same as DataView.getUint32(off)
		classWord1 = binary.BigEndian.Uint32(b[off0 : off0+4])
		w1 := binary.BigEndian.Uint32(b[off1 : off1+4])
		infoCode = uint16((w1 & 0xFFFF0000) >> 16)
		pktClass = uint16(w1 & 0x0000FFFF)
		optWordIndex += 2

		// Lower 24 bits of classWord1 are OUI
		oui = classWord1 & 0x00FFFFFF
	}

	// ---- Timestamps ----
	var intTS uint32
	if tsiType != 0 {
		off = kOffsetOptionalsBytes + (optWordIndex << 2)
		if off+4 > packetSizeBytes {
			return vitaView{}, errShort
		}
		intTS = binary.BigEndian.Uint32(b[off : off+4])
		optWordIndex++
	}

	var fracTS uint32
	if tsfType != 0 {
		offMSB := kOffsetOptionalsBytes + (optWordIndex << 2)
		offLSB := offMSB + 4
		if offLSB+4 > packetSizeBytes {
			return vitaView{}, errShort
		}
		// msb := binary.BigEndian.Uint32(b[offMSB:offMSB+4]) // ignored (as in AS)
		lsb := binary.BigEndian.Uint32(b[offLSB : offLSB+4])
		fracTS = lsb
		optWordIndex += 2
	}

	// ---- Sizes ----
	headerSize := 4 * (1 + optWordIndex) // first header word + all optionals
	trailerBytes := 0
	if trailerPresent {
		trailerBytes = kTrailerSize
	}
	payloadSize := packetSizeBytes - headerSize - trailerBytes
	if payloadSize < 0 {
		return vitaView{}, errShort
	}

	start := headerSize
	end := start + payloadSize
	if end > len(b) || start > end {
		return vitaView{}, errShort
	}
	payload := b[start:end]

	return vitaView{
		TSI:                 uint8(tsiType),
		TSF:                 uint8(tsfType),
		HasClassID:          classIdPresent,
		HasTrailer:          trailerPresent,
		StreamID:            streamID,
		OUI:                 oui,
		ClassInfo:           infoCode,
		ClassCode:           pktClass,
		IntegerTimestamp:    intTS,
		FractionalTimestamp: fracTS,
		Payload:             payload,
	}, nil
}

func (v vitaView) String() string {
	return fmt.Sprintf("VITA{stream=0x%08X class=0x%04X tsi=%d tsf=%d c=%v t=%v len=%d}",
		v.StreamID, v.ClassCode, v.TSI, v.TSF, v.HasClassID, v.HasTrailer, len(v.Payload))
}

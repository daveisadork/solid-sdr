package rtc

import (
	"math/rand"

	"github.com/pion/rtp"
)

// Minimal Opus payloader: treat incoming payload as one Opus packet (or already aggregated).
// rtp.Packetizer will split if larger than MTU.
type opusPayloader struct{}

func (o *opusPayloader) Payload(mtu uint16, payload []byte) [][]byte {
	return [][]byte{payload}
}

func newOpusPacketizer() rtp.Packetizer {
	return rtp.NewPacketizer(
		uint16(1200),     // MTU
		uint8(111),       // Opus PT
		rand.Uint32(),    // SSRC
		&opusPayloader{}, // Payloader
		rtp.NewRandomSequencer(),
		uint32(48000), // clock rate
	)
}

// Estimate samples per Opus payload; safe fallback is 960 (20 ms @ 48 kHz).
func opusFrameSamples(payload []byte) uint32 {
	if len(payload) == 0 {
		return 960
	}
	// TODO: parse TOC if you need exact frame duration
	return 960
}

package rtc

import (
	"encoding/binary"
	"errors"
	"io"
	"log"
	"strings"

	"github.com/daveisadork/flex-bridge/internal/core"
	"github.com/pion/webrtc/v4"
)

const (
	vitaPacketTypeExtDataWithStream = 3
	vitaTimeStampOther              = 3
	vitaTimeStampSampleCount        = 1
	vitaOpusHeaderWords             = 7
	vitaOpusFixedBytes              = 28
	vitaFlexOUI                     = 0x001C2D
	vitaFlexInfoClass               = 0x534C
	vitaFlexOpusClass               = 0x8005
)

func (s *Server) handleIncomingTrack(
	handleHex string,
	rs *core.RadioSession,
	track *webrtc.TrackRemote,
	receiver *webrtc.RTPReceiver,
) {
	if track == nil {
		return
	}

	if track.Kind() != webrtc.RTPCodecTypeAudio ||
		!strings.EqualFold(track.Codec().MimeType, webrtc.MimeTypeOpus) {
		log.Printf(
			"[rtc] ignoring inbound track handle=%s kind=%s codec=%s stream=%s track=%s",
			handleHex,
			track.Kind().String(),
			track.Codec().MimeType,
			track.StreamID(),
			track.ID(),
		)

		return
	}

	if receiver != nil && receiver.RTPTransceiver() != nil {
		log.Printf(
			"[rtc] reading inbound opus track handle=%s mid=%s stream=%s track=%s",
			handleHex,
			receiver.RTPTransceiver().Mid(),
			track.StreamID(),
			track.ID(),
		)
	}

	for {
		packet, _, err := track.ReadRTP()
		if err != nil {
			if !errors.Is(err, io.EOF) {
				log.Printf(
					"[rtc] inbound opus read ended handle=%s stream=%s track=%s err=%v",
					handleHex,
					track.StreamID(),
					track.ID(),
					err,
				)
			}

			return
		}

		if len(packet.Payload) == 0 {
			continue
		}

		streamID, packetCount, ok := rs.NextTXPacket()
		if !ok {
			continue
		}

		if rs.UDPConn == nil {
			continue
		}

		vitaPacket := buildTXOpusPacket(streamID, packetCount, packet.Payload)
		if _, err := rs.UDPConn.Write(vitaPacket); err != nil {
			log.Printf("[rtc] failed to forward tx opus packet stream=0x%08X err=%v", streamID, err)

			return
		}
	}
}

func buildTXOpusPacket(streamID uint32, packetCount uint8, payload []byte) []byte {
	// Packet size in 32-bit words fits in uint16: UDP payload max ~64KB → max ~16384 words, well under 65535.
	packetSizeWords := uint16((len(payload)+3)/4 + vitaOpusHeaderWords) //nolint:gosec
	packet := make([]byte, vitaOpusFixedBytes+len(payload))

	packet[0] = byte((vitaPacketTypeExtDataWithStream << 4) | 0x08)
	// Header byte: OR of two known constants (≤0xF0) with a 4-bit masked value (≤0x0F), always fits in byte.
	packet[1] = byte((vitaTimeStampOther << 6) | (vitaTimeStampSampleCount << 4) | int(packetCount&0x0F)) //nolint:gosec
	binary.BigEndian.PutUint16(packet[2:4], packetSizeWords)
	binary.BigEndian.PutUint32(packet[4:8], streamID)
	binary.BigEndian.PutUint32(packet[8:12], vitaFlexOUI)
	binary.BigEndian.PutUint16(packet[12:14], vitaFlexInfoClass)
	binary.BigEndian.PutUint16(packet[14:16], vitaFlexOpusClass)
	copy(packet[vitaOpusFixedBytes:], payload)

	return packet
}

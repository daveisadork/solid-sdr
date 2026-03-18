package rtc

import (
	"encoding/binary"
	"io"
	"log"
	"strings"
	"time"

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

	mid := ""
	if receiver != nil && receiver.RTPTransceiver() != nil {
		mid = receiver.RTPTransceiver().Mid()
	}

	streamID, compression, ok := waitForTXBinding(
		rs,
		"remote_audio_tx",
		track.StreamID(),
		track.ID(),
		2*time.Second,
	)
	if !ok {
		log.Printf(
			"[rtc] no tx stream available for inbound opus track handle=%s mid=%s stream=%s track=%s",
			handleHex,
			mid,
			track.StreamID(),
			track.ID(),
		)
		return
	}

	log.Printf(
		"[rtc] bound inbound opus track handle=%s mid=%s stream=%s track=%s to radio tx stream 0x%08X (compression=%s)",
		handleHex,
		mid,
		track.StreamID(),
		track.ID(),
		streamID,
		compression,
	)
	defer rs.ReleaseTXAudioTrackBinding(streamID, track.StreamID(), track.ID())

	for {
		packet, _, err := track.ReadRTP()
		if err != nil {
			if err != io.EOF {
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

		packetCount, ok := rs.NextTXPacketCount(streamID)
		if !ok {
			log.Printf("[rtc] tx stream 0x%08X removed while forwarding inbound audio", streamID)
			return
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

func waitForTXBinding(
	rs *core.RadioSession,
	typ string,
	remoteStreamID string,
	remoteTrackID string,
	timeout time.Duration,
) (uint32, string, bool) {
	deadline := time.Now().Add(timeout)

	for {
		if streamID, compression, ok := rs.BindTXAudioTrack(typ, remoteStreamID, remoteTrackID); ok {
			return streamID, compression, true
		}
		if time.Now().After(deadline) {
			return 0, "", false
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func buildTXOpusPacket(streamID uint32, packetCount uint8, payload []byte) []byte {
	packetSizeWords := uint16((len(payload)+3)/4 + vitaOpusHeaderWords)
	packet := make([]byte, vitaOpusFixedBytes+len(payload))

	packet[0] = byte((vitaPacketTypeExtDataWithStream << 4) | 0x08)
	packet[1] = byte((vitaTimeStampOther << 6) | (vitaTimeStampSampleCount << 4) | int(packetCount&0x0F))
	binary.BigEndian.PutUint16(packet[2:4], packetSizeWords)
	binary.BigEndian.PutUint32(packet[4:8], streamID)
	binary.BigEndian.PutUint32(packet[8:12], vitaFlexOUI)
	binary.BigEndian.PutUint16(packet[12:14], vitaFlexInfoClass)
	binary.BigEndian.PutUint16(packet[14:16], vitaFlexOpusClass)
	copy(packet[vitaOpusFixedBytes:], payload)

	return packet
}

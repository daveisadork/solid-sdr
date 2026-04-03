package rtc

import "encoding/binary"

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

func buildTXOpusPacket(streamID uint32, packetCount uint8, payload []byte) []byte {
	packetSizeWords := uint16((len(payload)+3)/4 + vitaOpusHeaderWords) //nolint:gosec
	packet := make([]byte, vitaOpusFixedBytes+len(payload))
	packet[0] = byte((vitaPacketTypeExtDataWithStream << 4) | 0x08)
	packet[1] = byte((vitaTimeStampOther << 6) | (vitaTimeStampSampleCount << 4) | int(packetCount&0x0F)) //nolint:gosec
	binary.BigEndian.PutUint16(packet[2:4], packetSizeWords)
	binary.BigEndian.PutUint32(packet[4:8], streamID)
	binary.BigEndian.PutUint32(packet[8:12], vitaFlexOUI)
	binary.BigEndian.PutUint16(packet[12:14], vitaFlexInfoClass)
	binary.BigEndian.PutUint16(packet[14:16], vitaFlexOpusClass)
	copy(packet[vitaOpusFixedBytes:], payload)

	return packet
}

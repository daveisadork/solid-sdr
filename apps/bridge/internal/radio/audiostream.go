package radio

import (
	"strconv"
	"strings"
)

type AudioStream struct {
	StreamID     uint32
	Type         string
	Compression  string
	ClientHandle uint32
	IP           string
	DAXChannel   uint8
	Slice        string
	TX           bool
}

func parseAudioStream(line string) (stream AudioStream, ok bool) {
	stream = AudioStream{
		StreamID:     extractUint32(line, "stream 0x"),
		Type:         extractString(line, "type="),
		Compression:  extractString(line, "compression="),
		ClientHandle: extractUint32(line, "client_handle=0x"),
		IP:           extractString(line, "ip="),
		DAXChannel:   extractUint8(line, "dax_channel="),
		Slice:        extractString(line, "slice="),
		TX:           extractBool(line, "tx="),
	}
	return stream, stream.StreamID != 0
}

func extractString(line, key string) (value string) {
	if i := strings.Index(line, key); i != -1 {
		j := i + len(key)
		k := j
		for k < len(line) && line[k] != ' ' {
			k++
		}
		value = line[j:k]
	}
	return value
}

func extractBool(line, key string) (value bool) {
	return extractString(line, key) == "true"
}

func extractUint8(line, key string) (value uint8) {
	if v, err := strconv.ParseUint(extractString(line, key), 10, 8); err == nil {
		value = uint8(v)
	}
	return value
}

func extractUint32(line, key string) (value uint32) {
	if v, err := strconv.ParseUint(extractString(line, key), 16, 32); err == nil {
		value = uint32(v)
	}
	return value
}

package rtc

import (
	"strconv"
	"strings"
)

type audioStream struct {
	StreamID     uint32
	Type         string
	Compression  string
	ClientHandle uint32
	Removed      bool
}

func parseAudioStream(line string) (audioStream, bool) {
	s := audioStream{
		StreamID:     extractUint32(line, "stream 0x"),
		Type:         extractString(line, "type="),
		Compression:  extractString(line, "compression="),
		ClientHandle: extractUint32(line, "client_handle=0x"),
		Removed:      strings.Contains(line, " removed"),
	}

	return s, s.StreamID != 0
}

func extractString(line, key string) string {
	i := strings.Index(line, key)
	if i == -1 {
		return ""
	}

	j := i + len(key)

	k := j
	for k < len(line) && line[k] != ' ' {
		k++
	}

	return line[j:k]
}

func extractUint32(line, key string) uint32 {
	v, err := strconv.ParseUint(extractString(line, key), 16, 32)
	if err != nil {
		return 0
	}

	return uint32(v)
}

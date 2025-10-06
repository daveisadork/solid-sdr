package rtc

import (
	"time"

	"github.com/daveisadork/flex-bridge/internal/core"
	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

// startUDPDemux reads UDP from the radio and fans out:
//   - Opus (VITA class 0x8005 or matching AudioStreamID) → WebRTC sample track
//   - everything else → RTC datachannel "udp"
func startUDPDemux(rs *core.RadioSession) {
	if rs.UDPConn == nil {
		return
	}

	buf := make([]byte, 64*1024)

	go func() {
		defer func() {
			if rs.UDPConn != nil {
				_ = rs.UDPConn.Close()
				rs.UDPConn = nil
			}
		}()

		for {
			_ = rs.UDPConn.SetReadDeadline(time.Now().Add(30 * time.Second))
			n, err := rs.UDPConn.Read(buf)
			if n == 0 && err != nil {
				if ne, ok := err.(interface{ Timeout() bool }); ok && ne.Timeout() {
					continue
				}
				return
			}
			p := buf[:n]

			v, perr := parseVITA(p)
			if perr != nil {
				continue
			}

			// Treat as audio if either it's the announced audio stream or the Opus class code.
			isAudio := (rs.AudioStreamID != 0 && v.StreamID == rs.AudioStreamID) || v.ClassCode == 0x8005

			if isAudio {
				if rs.AudioSample == nil || len(v.Payload) == 0 {
					continue
				}
				frames := opusFrameCount(v.Payload) // 10 ms per frame
				if frames <= 0 {
					frames = 1
				}
				_ = rs.AudioSample.WriteSample(media.Sample{
					Data:     append([]byte(nil), v.Payload...), // copy; buf is reused
					Duration: time.Duration(frames) * 10 * time.Millisecond,
				})
				continue
			}

			// Non-audio → data channel (if open)
			if dc := rs.DC; dc != nil && dc.ReadyState() == webrtc.DataChannelStateOpen {
				// coarse backpressure
				for dc.BufferedAmount() > (1 << 20) {
					time.Sleep(2 * time.Millisecond)
				}
				const chunk = 16 * 1024
				for off := 0; off < len(p); off += chunk {
					end := off + chunk
					if end > len(p) {
						end = len(p)
					}
					_ = dc.Send(p[off:end])
				}
			}
		}
	}()
}

// ---- Opus helpers ----
// Counts 10 ms Opus frames (RFC 6716 §3.2.1).
func opusFrameCount(b []byte) int {
	if len(b) < 1 {
		return 0
	}
	toc := b[0]
	switch toc & 0x03 {
	case 0: // one frame
		return 1
	case 1: // two CBR frames
		return 2
	case 2: // N frames in next byte
		if len(b) < 2 {
			return 0
		}
		n := int(b[1])
		if n < 1 || n > 48 {
			return 0
		}
		return n
	case 3: // self-delimited frames
		i := 1
		frames := 0
		for i < len(b) {
			size, n := opusReadSize(b, i)
			if n == 0 || i+n+size > len(b) {
				return 0
			}
			i += n + size
			frames++
		}
		if frames < 1 || frames > 48 {
			return 0
		}
		return frames
	default:
		return 0
	}
}

func opusReadSize(b []byte, i int) (size int, n int) {
	if i >= len(b) {
		return 0, 0
	}
	sz := int(b[i])
	if sz < 252 {
		return sz, 1
	}
	if i+1 >= len(b) {
		return 0, 0
	}
	return 252 + int(b[i+1]), 2
}

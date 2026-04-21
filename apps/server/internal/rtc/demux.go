package rtc

import (
	"log"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
)

func startUDPDemux(rc *radioConn, audioTrack *webrtc.TrackLocalStaticSample) {
	rc.mu.RLock()
	u := rc.udpConn
	rc.mu.RUnlock()

	if u == nil {
		log.Println("[rtc] startUDPDemux: no UDP conn")

		return
	}

	buf := make([]byte, 64*1024)

	go func() {
		defer func() {
			rc.mu.Lock()
			if rc.udpConn != nil {
				_ = rc.udpConn.Close()
				rc.udpConn = nil
			}
			rc.mu.Unlock()
		}()

		for {
			rc.mu.RLock()
			u := rc.udpConn
			rc.mu.RUnlock()

			if u == nil {
				return
			}

			_ = u.SetReadDeadline(time.Now().Add(30 * time.Second))

			n, err := u.Read(buf)
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

			if v.ClassCode == 0x8005 {
				if audioTrack == nil || len(v.Payload) == 0 {
					continue
				}

				frames := opusFrameCount(v.Payload)
				if frames <= 0 {
					frames = 1
				}

				_ = audioTrack.WriteSample(media.Sample{
					Data:     append([]byte(nil), v.Payload...),
					Duration: time.Duration(frames) * 10 * time.Millisecond,
				})

				continue
			}

			rc.mu.RLock()
			dc := rc.udpDC
			rc.mu.RUnlock()

			if dc != nil && dc.ReadyState() == webrtc.DataChannelStateOpen {
				for dc.BufferedAmount() > (1 << 20) {
					time.Sleep(2 * time.Millisecond)
				}

				const chunk = 16 * 1024
				for off := 0; off < len(p); off += chunk {
					end := min(off+chunk, len(p))
					_ = dc.Send(p[off:end])
				}
			}
		}
	}()
}

func opusFrameCount(b []byte) int {
	if len(b) < 1 {
		return 0
	}

	toc := b[0]
	switch toc & 0x03 {
	case 0:
		return 1
	case 1:
		return 2
	case 2:
		if len(b) < 2 {
			return 0
		}

		n := int(b[1])
		if n < 1 || n > 48 {
			return 0
		}

		return n
	case 3:
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

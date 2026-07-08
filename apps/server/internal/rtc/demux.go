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

	go rc.demuxLoop(audioTrack)
}

// demuxLoop reads VITA packets from the radio's UDP socket until the socket is
// closed, routing Opus audio (class 0x8005) to the WebRTC track and everything
// else to the client's UDP data channel.
func (rc *radioConn) demuxLoop(audioTrack *webrtc.TrackLocalStaticSample) {
	defer rc.closeUDP()

	rc.mu.RLock()
	raddr := rc.udpRaddr
	rc.mu.RUnlock()

	buf := make([]byte, 64*1024)

	for {
		rc.mu.RLock()
		u := rc.udpConn
		rc.mu.RUnlock()

		if u == nil {
			return
		}

		_ = u.SetReadDeadline(time.Now().Add(30 * time.Second))

		n, src, err := u.ReadFromUDP(buf)
		if n == 0 && err != nil {
			if ne, ok := err.(interface{ Timeout() bool }); ok && ne.Timeout() {
				continue
			}

			return
		}

		// Accept packets from any source port the radio uses but only
		// from the radio's IP.
		if raddr != nil && !src.IP.Equal(raddr.IP) {
			continue
		}

		p := buf[:n]

		v, perr := parseVITA(p)
		if perr != nil {
			continue
		}

		if v.ClassCode == 0x8005 {
			writeAudioSample(v, audioTrack)

			continue
		}

		rc.forwardToDataChannel(p)
	}
}

// closeUDP closes and clears the radio's UDP socket. Safe to call more than once.
func (rc *radioConn) closeUDP() {
	rc.mu.Lock()
	if rc.udpConn != nil {
		_ = rc.udpConn.Close()
		rc.udpConn = nil
	}
	rc.mu.Unlock()
}

// writeAudioSample decodes the Opus frame count from a VITA audio payload and
// writes it to the WebRTC track. No-op when there is no track or payload.
func writeAudioSample(v vitaView, audioTrack *webrtc.TrackLocalStaticSample) {
	if audioTrack == nil || len(v.Payload) == 0 {
		return
	}

	frames := opusFrameCount(v.Payload)
	if frames <= 0 {
		frames = 1
	}

	_ = audioTrack.WriteSample(media.Sample{
		Data:     append([]byte(nil), v.Payload...),
		Duration: time.Duration(frames) * 10 * time.Millisecond,
	})
}

// forwardToDataChannel relays a raw packet to the client's UDP data channel in
// chunks, applying backpressure when the channel's send buffer is full.
func (rc *radioConn) forwardToDataChannel(p []byte) {
	rc.mu.RLock()
	dc := rc.udpDC
	rc.mu.RUnlock()

	if dc == nil || dc.ReadyState() != webrtc.DataChannelStateOpen {
		return
	}

	for dc.BufferedAmount() > (1 << 20) {
		time.Sleep(2 * time.Millisecond)
	}

	const chunk = 16 * 1024
	for off := 0; off < len(p); off += chunk {
		end := min(off+chunk, len(p))
		_ = dc.Send(p[off:end])
	}
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

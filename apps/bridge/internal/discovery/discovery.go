package discovery

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

type Options struct {
	Port           int
	IdleRestart    time.Duration // default 30s
	HealthInterval time.Duration // default 5s
	MaxBackoff     time.Duration // default 5s
}

type Service struct {
	opt Options

	mu sync.Mutex
	c4 net.PacketConn
	c6 net.PacketConn

	// lastPktUnix holds the time of the most recent packet in Unix nanos (atomic)
	lastPktUnix atomic.Int64

	subMu sync.Mutex
	subs  map[chan []byte]struct{}
}

func New(opt Options) *Service {
	if opt.IdleRestart == 0 {
		opt.IdleRestart = 30 * time.Second
	}
	if opt.HealthInterval == 0 {
		opt.HealthInterval = 5 * time.Second
	}
	if opt.MaxBackoff == 0 {
		opt.MaxBackoff = 5 * time.Second
	}
	s := &Service{opt: opt, subs: make(map[chan []byte]struct{})}
	s.lastPktUnix.Store(time.Now().UnixNano())
	return s
}

func (s *Service) Run(ctx context.Context) error {
	backoff := 0 * time.Millisecond
	for {
		if err := s.bindAll(ctx); err != nil {
			backoff = next(backoff, s.opt.MaxBackoff)
			log.Printf("[discovery] bind error: %v; retrying in %v", err, backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return ctx.Err()
			}
			continue
		}
		backoff = 0
		if err := s.serve(ctx); err != nil {
			if errors.Is(err, context.Canceled) {
				return nil
			}
			log.Printf("[discovery] serve ended: %v", err)
		}
	}
}

func (s *Service) bindAll(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Close any prior sockets first
	if s.c4 != nil {
		_ = s.c4.Close()
		s.c4 = nil
	}
	if s.c6 != nil {
		_ = s.c6.Close()
		s.c6 = nil
	}

	addr := fmt.Sprintf(":%d", s.opt.Port)
	lc := net.ListenConfig{Control: applyUDPSocketOptions}

	// 1) Try dual-stack UDP6 first
	if c6, err := lc.ListenPacket(ctx, "udp6", addr); err == nil {
		s.c6 = c6
		s.lastPktUnix.Store(time.Now().UnixNano())
		return nil
	}

	// 2) Fallback: bind separate sockets for IPv4 and IPv6
	var e4, e6 error
	c4, e4 := lc.ListenPacket(ctx, "udp4", addr)
	c6, e6 := lc.ListenPacket(ctx, "udp6", addr)

	if e4 != nil && e6 != nil {
		return errors.Join(e4, e6)
	}

	s.c4, s.c6 = c4, c6
	s.lastPktUnix.Store(time.Now().UnixNano())
	return nil
}

func (s *Service) serve(ctx context.Context) error {
	s.mu.Lock()
	c4, c6 := s.c4, s.c6
	s.mu.Unlock()
	errCh := make(chan error, 2)
	done := make(chan struct{})
	if c4 != nil {
		go s.readLoop(ctx, c4, errCh, done)
	}
	if c6 != nil {
		go s.readLoop(ctx, c6, errCh, done)
	}
	health := time.NewTicker(s.opt.HealthInterval)
	defer health.Stop()
	for {
		select {
		case err := <-errCh:
			close(done)
			s.closeAll()
			return err
		case <-health.C:
			last := time.Unix(0, s.lastPktUnix.Load())
			if time.Since(last) > s.opt.IdleRestart {
				close(done)
				s.closeAll()
				return errors.New("idle restart")
			}
		case <-ctx.Done():
			close(done)
			s.closeAll()
			return ctx.Err()
		}
	}
}

func (s *Service) readLoop(ctx context.Context, pc net.PacketConn, errCh chan<- error, done <-chan struct{}) {
	buf := make([]byte, 64*1024)
	for {
		_ = pc.SetReadDeadline(time.Now().Add(10 * time.Second))
		n, _, err := pc.ReadFrom(buf)
		if ne, ok := err.(net.Error); ok && ne.Timeout() {
			continue
		}
		if err != nil {
			errCh <- err
			return
		}
		pkt := append([]byte(nil), buf[:n]...)
		s.lastPktUnix.Store(time.Now().UnixNano())
		s.broadcast(pkt)
		select {
		case <-done:
			return
		default:
		}
		select {
		case <-ctx.Done():
			return
		default:
		}
	}
}

func (s *Service) broadcast(b []byte) {
	s.subMu.Lock()
	for ch := range s.subs {
		select {
		case ch <- b:
		default:
		}
	}
	s.subMu.Unlock()
}

func (s *Service) closeAll() {
	s.mu.Lock()
	if s.c4 != nil {
		_ = s.c4.Close()
		s.c4 = nil
	}
	if s.c6 != nil {
		_ = s.c6.Close()
		s.c6 = nil
	}
	s.mu.Unlock()
}

// Subscription API for WS handler
func (s *Service) Subscribe() chan []byte {
	ch := make(chan []byte, 256)
	s.subMu.Lock()
	s.subs[ch] = struct{}{}
	s.subMu.Unlock()
	return ch
}

func (s *Service) Unsubscribe(ch chan []byte) {
	s.subMu.Lock()
	delete(s.subs, ch)
	close(ch)
	s.subMu.Unlock()
}

// WSHandler streams discovery packets to a websocket client as binary frames.
func (s *Service) WSHandler(w http.ResponseWriter, r *http.Request) {
	up := websocket.Upgrader{
		CheckOrigin:       func(*http.Request) bool { return true },
		EnableCompression: false, // disabled due to interoperability/perf issues
	}
	ws, err := up.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = ws.Close() }()
	ch := s.Subscribe()
	defer s.Unsubscribe(ch)
	for pkt := range ch {
		_ = ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := ws.WriteMessage(websocket.BinaryMessage, pkt); err != nil {
			return
		}
	}
}

// helpers
// next grows exponential backoff with bounded jitter (all in time.Duration units).
func next(cur, max time.Duration) time.Duration {
	if cur <= 0 {
		cur = 250 * time.Millisecond
	} else {
		cur *= 2
		if cur > max {
			cur = max
		}
	}
	// jitter in [0, max(cur/4, 50ms)]
	jmax := cur / 4
	if jmax < 50*time.Millisecond {
		jmax = 50 * time.Millisecond
	}
	// rand.Int63n expects int64 nanoseconds; no extra *time.Millisecond!
	jitter := time.Duration(rand.Int63n(int64(jmax)))
	return cur + jitter
}

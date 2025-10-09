// internal/nat/natmap.go
package nat

import (
	"fmt"
	"log"
	"time"

	gonat "github.com/fd/go-nat"
)

type Mapper struct {
	nat gonat.NAT
	// keep what we mapped so we can clean up
	maps []mapping
	stop chan struct{}
}

type mapping struct {
	Proto       string
	Internal    int
	External    int
	Description string
	TTL         time.Duration
}

func Discover() (*Mapper, string, error) {
	n, err := gonat.DiscoverGateway()
	if err != nil {
		return nil, "", fmt.Errorf("nat discovery: %w", err)
	}
	if n == nil {
		return nil, "", fmt.Errorf("no NAT device found")
	}

	ip, err := n.GetExternalAddress()
	if err != nil {
		return nil, "", fmt.Errorf("external ip: %w", err)
	}
	return &Mapper{nat: n, stop: make(chan struct{})}, ip.String(), nil
}

// Map a UDP port. If external==0, most implementations will pick same as internal.
func (m *Mapper) MapUDP(internal int, desc string, ttl time.Duration) error {
	if m == nil || m.nat == nil {
		return fmt.Errorf("nat mapper not ready")
	}
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	if external, err := m.nat.AddPortMapping("udp", internal, desc, ttl); err != nil {
		return err
	} else {
		log.Printf("[nat] mapped udp %d->%d (%s) ttl %s", internal, external, desc, ttl)
		m.maps = append(m.maps, mapping{
			Proto: "udp", Internal: internal, External: external, Description: desc, TTL: ttl,
		})
	}
	return nil
}

// Start a refresher that renews all mappings before TTL expiry.
func (m *Mapper) StartRefresher(interval time.Duration) {
	if m == nil || m.nat == nil {
		return
	}
	if interval <= 0 {
		interval = 10 * time.Minute
	}
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-m.stop:
				return
			case <-t.C:
				for _, mp := range m.maps {
					// re-add to extend TTL
					if external, err := m.nat.AddPortMapping(mp.Proto, mp.Internal, mp.Description, mp.TTL); err != nil {
						log.Printf("[nat] refresh %s %d->%d failed: %v", mp.Proto, mp.Internal, mp.External, err)
					} else {
						mp.External = external // in case it changed
					}
				}
			}
		}
	}()
}

func (m *Mapper) Close() {
	log.Printf("[nat] closing")
	if m == nil || m.nat == nil {
		return
	}
	close(m.stop)
	for _, mp := range m.maps {
		log.Printf("[nat] removing %s %d->%d", mp.Proto, mp.Internal, mp.External)
		if err := m.nat.DeletePortMapping(mp.Proto, mp.Internal); err != nil {
			log.Printf("[nat] delete %s %d->%d failed: %v", mp.Proto, mp.Internal, mp.External, err)
		}
	}
}

//go:build !windows

package discovery

import (
	"syscall"

	"github.com/google/uuid"
	"golang.org/x/sys/unix"
)

// applyUDPSocketOptions is used by net.ListenConfig.Control.
// It enables SO_REUSEADDR always, tries SO_REUSEPORT, and for UDP6 also clears IPV6_V6ONLY.
func applyUDPSocketOptions(network, address string, rc syscall.RawConn) error {
	var retErr error
	_ = rc.Control(func(fd uintptr) {
		// SO_REUSEADDR (always, ignore errors)
		if err := unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEADDR, 1); err != nil && retErr == nil {
			retErr = err
		}
		// SO_REUSEPORT (best effort; not all OSes support it)
		_ = unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEPORT, 1)

		// If this is a UDP6 socket, try to make it dual-stack (IPV6_V6ONLY=0)
		if network == "udp6" {
			_ = unix.SetsockoptInt(int(fd), unix.IPPROTO_IPV6, unix.IPV6_V6ONLY, 0)
		}

		// (Optional) set a low-level receive buffer if you like
		_ = unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_RCVBUF, 1<<20) // 1MB
	})
	return retErr
}

// Small unused ref to keep unix imported if the compiler gets cute.
var _ = uuid.Nil

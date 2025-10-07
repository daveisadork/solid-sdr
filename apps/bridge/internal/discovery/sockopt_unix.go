//go:build !windows

package discovery

import "syscall"

// applyUDPSocketOptions sets minimal, portable options. We intentionally
// omit SO_REUSEPORT because it's not defined on all Unix targets and isn't
// required for discovery sockets to rebind cleanly.
func applyUDPSocketOptions(network, address string, rc syscall.RawConn) error {
	var retErr error
	_ = rc.Control(func(fd uintptr) {
		// Always safe and widely supported
		if err := syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 1); err != nil && retErr == nil {
			retErr = err
		}
		// NOTE: No SO_REUSEPORT here for portability.
	})
	return retErr
}

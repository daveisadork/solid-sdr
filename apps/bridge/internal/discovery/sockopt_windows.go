//go:build windows

package discovery

import "syscall"

// ipprotoIPv6 and ipv6V6Only are well-known constants (RFC 3493 / WinSock2).
// The syscall package for Windows doesn't export them, so we define them here.
const (
	ipprotoIPv6 = 41
	ipv6V6Only  = 27
)

func applyUDPSocketOptions(network, _ string, rc syscall.RawConn) error {
	var retErr error
	_ = rc.Control(func(fd uintptr) {
		h := syscall.Handle(fd)
		if err := syscall.SetsockoptInt(h, syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 1); err != nil && retErr == nil {
			retErr = err
		}
		// Clear IPV6_V6ONLY so the udp6 socket accepts IPv4-mapped addresses too.
		// Without this, Windows defaults to IPv6-only and FlexRadio's IPv4
		// discovery broadcasts are silently discarded.
		if network == "udp6" {
			_ = syscall.SetsockoptInt(h, ipprotoIPv6, ipv6V6Only, 0)
		}
	})
	return retErr
}

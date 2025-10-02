//go:build !windows

package discovery

import "syscall"

func applyUDPSocketOptions(network, address string, rc syscall.RawConn) error {
	var retErr error
	_ = rc.Control(func(fd uintptr) {
		if err := syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 1); err != nil && retErr == nil {
			retErr = err
		}
		_ = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_REUSEPORT, 1)
	})
	return retErr
}

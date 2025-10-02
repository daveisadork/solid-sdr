//go:build windows

package discovery

import "syscall"

func applyUDPSocketOptions(network, address string, rc syscall.RawConn) error {
	var retErr error
	_ = rc.Control(func(fd uintptr) {
		if err := syscall.SetsockoptInt(syscall.Handle(fd), syscall.SOL_SOCKET, syscall.SO_REUSEADDR, 1); err != nil && retErr == nil {
			retErr = err
		}
	})
	return retErr
}

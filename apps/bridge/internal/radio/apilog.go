package radio

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type apiLogger struct {
	mu      sync.Mutex
	file    *os.File
	connSeq uint64
}

type connLogger struct {
	parent *apiLogger
	label  string
}

func newAPILogger(path string) (*apiLogger, error) {
	if path == "" {
		return nil, nil
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return nil, err
	}
	return &apiLogger{file: f}, nil
}

func (l *apiLogger) Close() error {
	if l == nil || l.file == nil {
		return nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if err := l.file.Sync(); err != nil {
		_ = l.file.Close()
		return err
	}
	return l.file.Close()
}

func (l *apiLogger) NewConnection(handleHex string, host string, port int) *connLogger {
	if l == nil {
		return nil
	}
	seq := atomic.AddUint64(&l.connSeq, 1)
	handle := strings.ToUpper(strings.TrimSpace(handleHex))
	if handle == "" {
		handle = "NOHANDLE"
	}
	label := fmt.Sprintf("#%03d H%s %s:%d", seq, handle, host, port)
	return &connLogger{parent: l, label: label}
}

func (c *connLogger) LogInbound(msg string) {
	c.log("IN", msg)
}

func (c *connLogger) LogOutbound(msg string) {
	c.log("OUT", msg)
}

func (c *connLogger) log(direction string, msg string) {
	if c == nil || c.parent == nil || c.parent.file == nil {
		return
	}
	ts := time.Now().UTC().Format("2006-01-02T15:04:05.000000Z")
	d := fixedWidth(strings.ToUpper(direction), 4)
	label := fixedWidth(c.label, 32)
	line := fmt.Sprintf("%s %s %s %s\n", ts, d, label, sanitizeMessage(msg))
	c.parent.mu.Lock()
	_, _ = c.parent.file.WriteString(line)
	c.parent.mu.Unlock()
}

func fixedWidth(s string, width int) string {
	if len(s) > width {
		return s[:width]
	}
	return fmt.Sprintf("%-*s", width, s)
}

func sanitizeMessage(msg string) string {
	msg = strings.TrimRight(msg, "\r\n")
	if msg == "" {
		return "<empty>"
	}
	return msg
}

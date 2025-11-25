package radio

import (
	"bufio"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/daveisadork/flex-bridge/internal/core"
	"github.com/daveisadork/flex-bridge/internal/rtc"
	"github.com/gorilla/websocket"
)

type WSHandler struct {
	Sessions *core.SessionManager
	RTC      *rtc.Server

	Upgrader  websocket.Upgrader
	apiLogger *apiLogger
}

type WSOptions struct {
	APILogFile string
}

func NewWSHandler(sessions *core.SessionManager, rtcServer *rtc.Server, opts WSOptions) (*WSHandler, error) {
	logger, err := newAPILogger(opts.APILogFile)
	if err != nil {
		return nil, err
	}
	return &WSHandler{
		Sessions: sessions,
		RTC:      rtcServer,
		Upgrader: websocket.Upgrader{
			ReadBufferSize:    64 * 1024,
			WriteBufferSize:   64 * 1024,
			CheckOrigin:       func(*http.Request) bool { return true },
			EnableCompression: false, // avoid permessage-deflate
		},
		apiLogger: logger,
	}, nil
}

func (h *WSHandler) Close() error {
	if h == nil || h.apiLogger == nil {
		return nil
	}
	return h.apiLogger.Close()
}

// /ws/radio?host=X&port=Y
func (h *WSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ws, err := h.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = ws.Close() }()

	q := r.URL.Query()
	host := q.Get("host")
	portStr := q.Get("port")
	if host == "" || portStr == "" {
		_ = ws.WriteControl(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "missing host/port"),
			time.Now().Add(2*time.Second))
		return
	}
	basePort, err := strconv.Atoi(portStr)
	if err != nil || basePort <= 0 || basePort > 65535 {
		_ = ws.WriteControl(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "invalid port"),
			time.Now().Add(2*time.Second))
		return
	}

	// TCP connect to radio
	tcp, err := net.DialTimeout("tcp", net.JoinHostPort(host, portStr), 9*time.Second)
	if err != nil {
		log.Printf("[ws] tcp dial error: %v", err)
		_ = ws.WriteControl(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseTryAgainLater, "tcp connect failed"),
			time.Now().Add(2*time.Second))
		return
	}
	defer func() { _ = tcp.Close() }()

	rd := bufio.NewReader(tcp)

	// Read first two lines from radio (version "V..." and handle "H....")
	// Always TRIM whitespace before sending to UI.
	line1Raw, err1 := rd.ReadString('\n')
	if err1 != nil {
		log.Printf("[ws] read first line: %v", err1)
		return
	}
	line2Raw, err2 := rd.ReadString('\n')
	if err2 != nil {
		log.Printf("[ws] read second line: %v", err2)
		return
	}
	l1 := strings.TrimSpace(line1Raw)
	l2 := strings.TrimSpace(line2Raw)

	// Determine version vs handle
	versionLine, handleLine := l1, l2
	if strings.HasPrefix(l1, "H") {
		versionLine, handleLine = l2, l1
	}

	// Extract hex handle (uppercase, no leading "H")
	handleHex := strings.ToUpper(strings.TrimPrefix(handleLine, "H"))

	// Register session (store TCP, host/port, and metadata)
	rs := h.Sessions.PutTCP(handleHex, host, basePort, tcp)
	rs.Version = versionLine
	if u, err := strconv.ParseUint(handleHex, 16, 32); err == nil {
		rs.HandleU32 = uint32(u)
	}

	connLog := h.apiLogger.NewConnection(handleHex, host, basePort)

	// Forward the first two lines TRIMMED to the frontend
	connLog.LogInbound(l1)
	connLog.LogInbound(l2)
	_ = ws.WriteMessage(websocket.TextMessage, []byte(versionLine))
	_ = ws.WriteMessage(websocket.TextMessage, []byte(handleLine))

	// TCP -> WS forwarder (trim + stream detection)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			b, err := rd.ReadString('\n')
			if err != nil {
				return
			}
			line := strings.TrimSpace(b)
			log.Printf("[ws] %s:%d <%s", host, basePort, line)
			connLog.LogInbound(line)

			// Forward trimmed line to UI
			if err := ws.WriteMessage(websocket.TextMessage, []byte(line)); err != nil {
				return
			}

			// Observe "stream …" creations and notify RTC
			if ok, sid, typ, comp := parseStreamCreate(line); ok {
				// We already know the handle for this TCP session (handleHex)
				if h.RTC != nil {
					h.RTC.NoteStreamCreated(handleHex, sid, typ, comp)
				}
			}
		}
	}()

	// WS -> TCP writer (commands from UI)
	ws.SetReadLimit(1 << 20)
	_ = ws.SetReadDeadline(time.Time{})
	for {
		mt, msg, err := ws.ReadMessage()
		if err != nil {
			break
		}
		if mt == websocket.TextMessage || mt == websocket.BinaryMessage {
			log.Printf("[ws] %s:%d >%s", host, basePort, strings.TrimSpace(string(msg)))
			connLog.LogOutbound(strings.TrimSpace(string(msg)))
			// Pass through as-is; UI includes newline when needed.
			if _, err := tcp.Write(msg); err != nil {
				break
			}
		}
	}

	<-done
}

// Example expected line (trimmed):
// S143460AF|stream 0x04000008 type=remote_audio_rx compression=OPUS client_handle=0x143460AF ip=...
func parseStreamCreate(line string) (ok bool, streamID uint32, typ string, compression string) {
	if !strings.Contains(line, "stream ") || !strings.Contains(line, "type=") {
		return false, 0, "", ""
	}
	// type
	if i := strings.Index(line, "type="); i != -1 {
		j := i + len("type=")
		k := j
		for k < len(line) && line[k] != ' ' {
			k++
		}
		typ = line[j:k]
	}
	// compression
	if i := strings.Index(line, "compression="); i != -1 {
		j := i + len("compression=")
		k := j
		for k < len(line) && line[k] != ' ' {
			k++
		}
		compression = line[j:k]
	}
	// stream id
	const key = "stream 0x"
	if i := strings.Index(line, key); i != -1 {
		j := i + len(key)
		k := j
		for k < len(line) && isHex(line[k]) {
			k++
		}
		if k > j {
			if v, err := strconv.ParseUint(line[j:k], 16, 32); err == nil {
				streamID = uint32(v)
			}
		}
	}
	if streamID == 0 || typ == "" {
		return false, 0, "", ""
	}
	return true, streamID, typ, compression
}

func isHex(b byte) bool {
	return (b >= '0' && b <= '9') || (b|0x20 >= 'a' && b|0x20 <= 'f')
}

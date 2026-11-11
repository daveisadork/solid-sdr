package rtc

import (
	"crypto/hmac"
	"crypto/sha1" //nolint:gosec // HMAC-SHA1 is the TURN REST API scheme, not a free choice
	"encoding/base64"
	"strconv"
	"time"
)

// The TURN server shows this label in its logs.
const turnUsernameLabel = "solid-sdr"

type turnCredentials struct {
	Username string
	Password string
}

// Make TURN credentials for one client with the TURN REST API scheme.
// The username contains the expiry time. The TURN server rejects the credentials after that time.
// The TURN server calculates the same password from the username and the shared secret.
func newTURNCredentials(secret string, ttl time.Duration, now time.Time) turnCredentials {
	username := strconv.FormatInt(now.Add(ttl).Unix(), 10) + ":" + turnUsernameLabel

	mac := hmac.New(sha1.New, []byte(secret))
	_, _ = mac.Write([]byte(username))

	return turnCredentials{
		Username: username,
		Password: base64.StdEncoding.EncodeToString(mac.Sum(nil)),
	}
}

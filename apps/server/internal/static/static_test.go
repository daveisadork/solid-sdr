//go:build !release

package static

import "testing"

func TestHandler_DevReturnsNil(t *testing.T) {
	t.Parallel()

	if Handler() != nil {
		t.Error("expected Handler() to return nil in dev builds")
	}
}

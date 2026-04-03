package rtc

import "testing"

func TestNextTXPacket_NoStream(t *testing.T) {
	rc := &radioConn{}

	_, _, ok := rc.nextTXPacket()
	if ok {
		t.Error("expected ok=false when no active TX stream")
	}
}

func TestNextTXPacket_IncrementsCount(t *testing.T) {
	rc := &radioConn{activeTXStream: 0x12345678}
	for i := range 16 {
		id, count, ok := rc.nextTXPacket()
		if !ok {
			t.Fatalf("step %d: expected ok=true", i)
		}

		if id != 0x12345678 {
			t.Errorf("step %d: streamID got 0x%08X", i, id)
		}

		if count != uint8(i) {
			t.Errorf("step %d: count got %d want %d", i, count, i)
		}
	}
}

func TestNextTXPacket_WrapsAt16(t *testing.T) {
	rc := &radioConn{activeTXStream: 0x12345678}
	for range 16 {
		rc.nextTXPacket()
	}

	_, count, _ := rc.nextTXPacket()
	if count != 0 {
		t.Errorf("count should wrap to 0, got %d", count)
	}
}

func TestNoteStreamCreated_RX(t *testing.T) {
	rc := &radioConn{handleHex: "TEST"}
	rc.noteStreamCreated(0x04000008, "remote_audio_rx", "OPUS")

	if rc.activeRXStream != 0x04000008 {
		t.Errorf("activeRXStream: got 0x%08X", rc.activeRXStream)
	}

	if rc.activeTXStream != 0 {
		t.Error("activeTXStream should be unset")
	}
}

func TestNoteStreamCreated_TX(t *testing.T) {
	rc := &radioConn{handleHex: "TEST"}
	rc.noteStreamCreated(0x08000001, "remote_audio_tx", "OPUS")

	if rc.activeTXStream != 0x08000001 {
		t.Errorf("activeTXStream: got 0x%08X", rc.activeTXStream)
	}

	if rc.txPacketCount != 0 {
		t.Error("txPacketCount should reset to 0")
	}
}

func TestNoteStreamCreated_NonOpusIgnored(t *testing.T) {
	rc := &radioConn{handleHex: "TEST"}
	rc.noteStreamCreated(0x04000008, "remote_audio_rx", "PCM")

	if rc.activeRXStream != 0 {
		t.Error("non-OPUS stream should be ignored")
	}
}

func TestNoteStreamRemoved_ClearsRX(t *testing.T) {
	rc := &radioConn{handleHex: "TEST", activeRXStream: 0x100, activeTXStream: 0x200}
	rc.noteStreamRemoved(0x100)

	if rc.activeRXStream != 0 {
		t.Error("activeRXStream should be cleared")
	}

	if rc.activeTXStream != 0x200 {
		t.Error("activeTXStream should be unchanged")
	}
}

func TestNoteStreamRemoved_ClearsTX(t *testing.T) {
	rc := &radioConn{handleHex: "TEST", activeRXStream: 0x100, activeTXStream: 0x200, txPacketCount: 5}
	rc.noteStreamRemoved(0x200)

	if rc.activeTXStream != 0 {
		t.Error("activeTXStream should be cleared")
	}

	if rc.txPacketCount != 0 {
		t.Error("txPacketCount should reset to 0")
	}

	if rc.activeRXStream != 0x100 {
		t.Error("activeRXStream should be unchanged")
	}
}

func TestNoteStreamRemoved_WrongID(t *testing.T) {
	rc := &radioConn{handleHex: "TEST", activeRXStream: 0x100}
	rc.noteStreamRemoved(0x999)

	if rc.activeRXStream != 0x100 {
		t.Error("activeRXStream should be unchanged for wrong ID")
	}
}

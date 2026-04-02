package radio

import "github.com/daveisadork/flex-bridge/internal/core"

type AudioStream = core.AudioStream

func parseAudioStream(line string) (AudioStream, bool) {
	return core.ParseAudioStream(line)
}

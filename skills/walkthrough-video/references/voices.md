# Voices

`scripts/tts.py` speaks each scene with one of three providers. Pick with `--provider`.

| Provider | Key | Default voice | Use for |
|---|---|---|---|
| `murf` | `MURF_API_KEY` | `en-US-natalie`, style `Narration` | Final videos |
| `elevenlabs` | `ELEVENLABS_API_KEY` | Brian (`nPczCjzI2devNBz1zQrb`) | Final videos |
| `say` | none | the macOS system voice | Draft takes, checking timing before spending credits |

## Keys

Read the key from the environment, or from a file with `--key-file`. If the user has not set one up, ask them to put it in a git-ignored file (for example `.env.video.local`) or export it in their shell, and to tell you where it is. Do not ask for it in the chat, do not echo it, and do not put it on a command line: chat transcripts and shell history are both kept.

```bash
export MURF_API_KEY=...            # in the user's own shell
python3 scripts/tts.py scenes.json --audio-dir work/audio --provider murf
python3 scripts/tts.py scenes.json --audio-dir work/audio --provider murf --key-file .env.video.key
```

## Choosing a voice

Use one voice for every video in a series: a change of narrator between part 2 and part 3 is distracting.

List what the account can use, then pass the id with `--voice`:

```bash
curl -s https://api.murf.ai/v1/speech/voices -H "api-key: $MURF_API_KEY"
curl -s https://api.elevenlabs.io/v1/voices -H "xi-api-key: $ELEVENLABS_API_KEY"
```

Murf voices have styles (`Narration`, `Conversational`, ...); pass one with `--style`. `Narration` is the calm default.

When the user asks for a slower or clearer delivery, first shorten the sentences and add scenes (see `narrative.md`). Voice settings change less than people expect.

## Costs and re-runs

Providers bill per character. `tts.py` keeps a hash of each scene's text and voice in `durations.json` and skips scenes that have not changed, so editing one line of the script regenerates one clip. A changed clip has a new length, so record again after any voice change: the recording is paced by the clip lengths.

Do a full draft with `--provider say` when the flow is new or fragile. The timing is close enough to prove the recording script, and the final voice is then generated once.

## API details

These are the calls the script makes, for when a provider changes its API or you need another provider.

**Murf**: `POST https://api.murf.ai/v1/speech/generate`, header `api-key`, JSON body `{voiceId, style, text, format: "WAV", sampleRate: 44100, channelType: "MONO"}`. The response has `audioFile`, a URL to download.

**ElevenLabs**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`, header `xi-api-key`, JSON body `{text, model_id: "eleven_multilingual_v2", voice_settings}`. The response body is the audio.

To add a provider, write a function `(text, dst, key, voice, style)` that leaves a WAV at `dst` and register it in `PROVIDERS`.

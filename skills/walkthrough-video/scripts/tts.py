#!/usr/bin/env python3
"""Turn the narration into one voice clip per scene.

Reads scenes.json:

    [{"id": "01", "lines": ["To add one, select Add task,", "give it a name,", "and save."]}, ...]

Each scene's lines are spoken as one clip; the same lines become the subtitles, one at a time.
Writes <audio-dir>/<id>.wav and <audio-dir>/durations.json, which the recorder and mux.py read.

Providers (--provider):
  murf        needs MURF_API_KEY        (default voice: en-US-natalie, style Narration)
  elevenlabs  needs ELEVENLABS_API_KEY  (default voice: Brian)
  say         macOS built-in voice. No key. Good for a draft take, not for the final video.

Keys come from the environment or from --key-file. They are never written to disk or printed.
A scene whose text and voice have not changed is not generated again, so a re-run after a
small script edit only pays for the scenes that changed. Use --force to redo everything.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request


def http(url, headers, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method='POST' if data else 'GET')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f'{url.split("?")[0]} answered {e.code}: {e.read()[:300].decode("utf-8", "replace")}')


def to_wav(src, dst):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ar', '44100', '-ac', '1', dst], check=True)
    if src != dst:
        os.remove(src)


def murf(text, dst, key, voice, style):
    body = {'voiceId': voice or 'en-US-natalie', 'style': style or 'Narration', 'text': text,
            'format': 'WAV', 'sampleRate': 44100, 'channelType': 'MONO'}
    r = json.loads(http('https://api.murf.ai/v1/speech/generate',
                        {'Content-Type': 'application/json', 'api-key': key}, body))
    if 'audioFile' not in r:
        sys.exit(f'Murf returned no audio: {json.dumps(r)[:300]}')
    with open(dst + '.tmp', 'wb') as f:
        f.write(http(r['audioFile'], {}))
    to_wav(dst + '.tmp', dst)


def elevenlabs(text, dst, key, voice, style):
    voice = voice or 'nPczCjzI2devNBz1zQrb'  # Brian
    body = {'text': text, 'model_id': 'eleven_multilingual_v2',
            'voice_settings': {'stability': 0.55, 'similarity_boost': 0.75, 'style': 0.15}}
    audio = http(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',
                 {'xi-api-key': key, 'content-type': 'application/json'}, body)
    with open(dst + '.mp3', 'wb') as f:
        f.write(audio)
    to_wav(dst + '.mp3', dst)


def say(text, dst, key, voice, style):
    cmd = ['say', '-o', dst + '.aiff']
    if voice:
        cmd += ['-v', voice]
    subprocess.run(cmd + [text], check=True)
    to_wav(dst + '.aiff', dst)


PROVIDERS = {'murf': (murf, 'MURF_API_KEY'), 'elevenlabs': (elevenlabs, 'ELEVENLABS_API_KEY'), 'say': (say, None)}


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True, check=True).stdout
    return round(float(out), 2)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('scenes', help='scenes.json')
    ap.add_argument('--audio-dir', default='audio')
    ap.add_argument('--provider', choices=PROVIDERS, default='murf')
    ap.add_argument('--voice', help='voice id for the provider')
    ap.add_argument('--style', help='Murf voice style, e.g. Narration, Conversational')
    ap.add_argument('--key-file', help='file holding the API key, if it is not in the environment')
    ap.add_argument('--force', action='store_true', help='generate every scene again')
    a = ap.parse_args()

    fn, env = PROVIDERS[a.provider]
    key = None
    if env:
        key = os.environ.get(env) or (open(a.key_file).read().strip() if a.key_file else None)
        if not key:
            sys.exit(f'{a.provider} needs an API key: set {env} or pass --key-file. '
                     'Do not paste the key into the chat; put it in a git-ignored file.')

    scenes = json.load(open(a.scenes))
    scenes = [s if isinstance(s, dict) else {'id': f'{i:02d}', 'lines': s} for i, s in enumerate(scenes, 1)]
    os.makedirs(a.audio_dir, exist_ok=True)
    dpath = os.path.join(a.audio_dir, 'durations.json')
    old = {s['id']: s for s in json.load(open(dpath))} if os.path.exists(dpath) else {}

    out, made = [], 0
    for s in scenes:
        sid = str(s['id'])
        lines = s.get('lines') or [s['text']]
        # An ellipsis character is read aloud by some voices; three dots are a pause for all of them.
        text = ' '.join(lines).replace('…', '...')
        digest = hashlib.sha256('|'.join([a.provider, a.voice or '', a.style or '', text]).encode()).hexdigest()[:16]
        wav = os.path.join(a.audio_dir, f'{sid}.wav')
        if not a.force and os.path.exists(wav) and old.get(sid, {}).get('hash') == digest:
            print(f'{sid}  kept       {old[sid]["duration"]:5.2f}s  {text}')
            out.append(old[sid])
            continue
        fn(text, wav, key, a.voice, a.style)
        made += 1
        d = duration(wav)
        print(f'{sid}  generated  {d:5.2f}s  {text}')
        out.append({'id': sid, 'lines': lines, 'duration': d, 'file': os.path.abspath(wav), 'hash': digest})

    json.dump(out, open(dpath, 'w'), indent=1, ensure_ascii=False)
    total = sum(s['duration'] for s in out)
    print(f'{len(out)} scenes, {made} generated, {total:.0f}s of voice -> {dpath}')


if __name__ == '__main__':
    main()

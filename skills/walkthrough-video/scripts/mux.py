#!/usr/bin/env python3
"""Lay the voice clips over the recording and write the final MP4, a matching .srt and a contact sheet.

    mux.py --rec out/ --audio-dir audio/ --output videos/03-publish-an-app.mp4

--rec is the recorder's output folder (raw.webm + timeline.json). Each clip is placed at the moment
its scene started in the recording, so voice and screen stay in step however long the page took to
respond. The audio is normalised to -16 LUFS, a comfortable level for laptop speakers.

The contact sheet (<output>.sheet.jpg) has one frame from the middle of every scene. Look at it
before showing the video to anyone: it is the fastest way to spot a missing highlight, a subtitle
covering the thing being discussed, or a scene recorded on the wrong screen.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile


def ts(x):
    ms = int(round(max(x, 0) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        sys.exit(f'{cmd[0]} failed:\n{p.stderr[-1500:]}')
    return p


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--rec', required=True, help='recorder output folder with raw.webm and timeline.json')
    ap.add_argument('--audio-dir', required=True, help='folder with <id>.wav from tts.py')
    ap.add_argument('--output', required=True, help='final .mp4')
    ap.add_argument('--lead', type=float, default=0.4, help='seconds of picture before the first word')
    ap.add_argument('--no-sheet', action='store_true')
    a = ap.parse_args()

    tl = json.load(open(os.path.join(a.rec, 'timeline.json')))
    scenes = tl['timeline']
    if not scenes:
        sys.exit('timeline.json has no scenes')
    raw = os.path.join(a.rec, 'raw.webm')
    if not os.path.exists(raw):
        sys.exit(f'{raw} is missing. Was the recording a dry run?')
    t0 = max(scenes[0]['start'] - a.lead, 0)
    end = tl['videoEnd']
    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)

    inputs = ['-ss', f'{t0:.3f}', '-to', f'{end:.3f}', '-i', raw]
    filters, labels = [], []
    for i, sc in enumerate(scenes, 1):
        clip = os.path.join(a.audio_dir, f"{sc['id']}.wav")
        if not os.path.exists(clip):
            sys.exit(f'{clip} is missing. Run tts.py again.')
        inputs += ['-i', clip]
        ms = int((sc['start'] - t0) * 1000)
        filters.append(f'[{i}:a]adelay={ms}|{ms},aformat=sample_rates=44100:channel_layouts=stereo[a{i}]')
        labels.append(f'[a{i}]')
    filters.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]')
    run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(filters), '-map', '0:v', '-map', '[aout]',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
         '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', a.output])

    # Subtitles: the same split as the lines shown on screen, each cue ending before the next starts.
    cues = []
    for sc in scenes:
        total = sum(len(l) for l in sc['lines']) or 1
        acc = 0
        for line in sc['lines']:
            start = sc['start'] - t0 + acc / total * sc['duration']
            acc += len(line)
            cues.append([start, sc['start'] - t0 + acc / total * sc['duration'] + 0.25, line])
    for i in range(len(cues) - 1):
        cues[i][1] = min(cues[i][1], cues[i + 1][0] - 0.05)
    srt = os.path.splitext(a.output)[0] + '.srt'
    with open(srt, 'w') as f:
        f.write('\n'.join(f'{n}\n{ts(s)} --> {ts(e)}\n{t}\n' for n, (s, e, t) in enumerate(cues, 1)))

    dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.output]).stdout)
    print(f'{a.output}  {dur:.1f}s, {len(scenes)} scenes')
    print(srt)

    if not a.no_sheet:
        sheet = os.path.splitext(a.output)[0] + '.sheet.jpg'
        cols = 3
        rows = math.ceil(len(scenes) / cols)
        with tempfile.TemporaryDirectory() as tmp:
            for i, sc in enumerate(scenes):
                at = min(sc['start'] - t0 + sc['duration'] * 0.6, dur - 0.1)
                run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{at:.2f}', '-i', a.output, '-frames:v', '1',
                     '-vf', 'scale=720:-1', os.path.join(tmp, f'f{i:03d}.jpg')])
            run(['ffmpeg', '-v', 'error', '-y', '-framerate', '1', '-i', os.path.join(tmp, 'f%03d.jpg'),
                 '-filter_complex', f'tile={cols}x{rows}:padding=6:color=white', '-frames:v', '1', sheet])
        print(sheet)


if __name__ == '__main__':
    main()

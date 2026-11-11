---
name: walkthrough-video
description: Produce a narrated walkthrough video of a web app - a screen recording with AI voiceover, subtitles, a visible cursor and highlights on the control being discussed - by running the app, scripting the story, recording it with Playwright and assembling an MP4 with ffmpeg. Use this whenever the user wants a demo video, feature walkthrough, product tour, how-to or explainer video, release or onboarding clip, or a "video to show my boss / CTO / client / team" of something in their app, and also when they ask to redo, shorten, slow down or re-voice a video made this way. Use it even if they only say "record the flow" or "make a video of this feature" without mentioning voiceover or subtitles.
---

# Walkthrough video

Turn "explain this feature" into a short MP4: the real app on screen, a voice explaining it, subtitles, a cursor that moves like a person's, and a ring around whatever is being talked about. The user briefs and reviews. You do everything else.

The work has one review gate that matters more than any other: **the user approves the narrative before anything is recorded.** A wording change costs seconds on a script and minutes on a video, and a wrong claim is far cheaper to catch on paper.

## What you need

- The app's source code, and an instance you can open and sign in to (local or a dev/staging environment). Never record against production: the take clicks real buttons.
- Playwright in the app's project (`node_modules/playwright` or `@playwright/test`). Most projects with E2E tests already have it. If not: `npm i -D playwright && npx playwright install chromium`.
- `ffmpeg` and `python3` on the PATH.
- A text-to-speech key for the final voice (Murf or ElevenLabs). Without one, `--provider say` uses the macOS voice, which is fine for a draft take. See `references/voices.md`.

Check these first and say plainly what is missing. Do not ask the user to paste an API key into the chat: ask them to put it in an environment variable or a git-ignored file and tell you where it is.

## The workflow

### 1. Take the brief

You need four things. Ask only for what the request does not already say.

- **Goal and audience.** "Align with the CTO on the new permissions page" produces a different video from "teach new members how to publish an app". The audience decides the length, the vocabulary and how much to explain.
- **The flow.** What to show, in order. If the user gives one, improve it and say what you changed and why: a better order, a missing step, a step that adds nothing. They asked for a video, not a transcription of their list.
- **Length.** Default to 60-120 seconds and one topic. If the flow needs more, propose two videos.
- **Voice.** Provider and voice, if they have a preference. Otherwise use the defaults.

### 2. Walk the flow in the real app before writing a word

Run the app, sign in with a demo account, and do every step of the flow yourself with Playwright or the browser. You are checking that each thing the narration will claim is true.

This is where most of the value of the skill comes from. Features are often described from memory or from the spec, and the app does something slightly different. If the app does not do what the user said it does, stop and tell them, with what you observed. Do not write narration that papers over it and do not quietly drop the step.

Note the exact labels on buttons and menus while you are there. The narration should use the words on the screen.

### 3. Seed demo data

A walkthrough on an empty or half-broken account looks like a bug report. Create what the story needs: an organisation, a few users with different roles, items with believable names. Use invented names only (Acme, Northwind, example.com): these videos get forwarded.

Keep a list of everything you create or change. You will put it back in step 9.

### 4. Write the narrative, then stop for review

Write it as a table and save it next to where the video will go, as `<nn>-<slug>.script.md`:

```markdown
| # | On screen | Voice-over | ~sec |
|---|---|---|---|
| 1 | Task list at rest. Ring on the list. | This is the team task list. / Everyone on the team sees the same tasks. | 5 |
| 2 | Cursor to **Add task**, form opens. Type a name, click **Save task**. | To add one, select Add task, / give it a name, / and save. | 7 |
```

The `/` marks split a scene's narration into subtitle lines. Read `references/narrative.md` before writing: it covers pacing, line length, before/after cards and the mistakes that make these videos hard to follow.

Show the table to the user and wait. Say the expected total length. If you changed their flow, say so here. Carry on only when they approve; if they ask for changes, send the revised table again.

### 5. Generate the voice

Write the approved narration to `scenes.json`, one entry per row, lines split at the `/` marks:

```json
[{ "id": "02", "lines": ["To add one, select Add task,", "give it a name,", "and save."] }]
```

```bash
python3 scripts/tts.py scenes.json --audio-dir work/audio --provider murf
```

This writes one clip per scene and `durations.json`. Voice comes before recording on purpose: each scene is held on screen for as long as its clip lasts, so the clip lengths have to exist first. Re-running only regenerates scenes whose text changed.

### 6. Write the recording script and dry-run it

Copy `example/record.cjs` and rewrite its scenes for this flow. `scripts/walkthrough.cjs` gives you:

| Helper | Use |
|---|---|
| `scene(id, async () => {...})` | One narrated scene. Shows its subtitles and holds until the voice has finished. |
| `clickAt(locator)` | Glide the cursor to the element, show the press, click it. Use this, not `locator.click()`, or things happen with no visible cause. |
| `moveTo(locator)` | Point at something without clicking. |
| `typeInto(locator, text)` | Click a field and type at a readable speed. |
| `ring(locator)` / `ring(null)` | Highlight what the voice is talking about; remove it when the voice moves on. |
| `step('Step 2 of 4 · Save')` | The label bottom-left that tells the viewer where they are. |
| `card({ title, subtitle })` | Full-screen title card, for the closing scene. |
| `card({ before, after })` | Before/after comparison. `card(null)` hides it. |
| `login: async (page) => {...}` | Option of `record()`. Signs in off camera so the video starts where the story starts. |

Prefer role and label locators (`getByRole`, `getByLabel`) over CSS: they survive restyling and they are the names the narration uses. Read names off the screen at run time where the data may differ between environments.

Run it with `dry` first:

```bash
node record.cjs <app-repo> work/rec work/audio/durations.json dry
```

A dry run records nothing and does not wait for the voice, so a wrong selector costs seconds, not a full take. Fix until every scene runs.

### 7. Record and assemble

```bash
node record.cjs <app-repo> work/rec work/audio/durations.json
python3 scripts/mux.py --rec work/rec --audio-dir work/audio --output walkthrough-videos/<nn>-<slug>.mp4
```

The recorder prints each scene's clip length next to how long its actions took. A scene flagged with seconds of silence after the voice has too much happening for what is said: trim the actions or give the voice more to say.

`mux.py` writes the MP4, a matching `.srt`, and `<name>.sheet.jpg`.

### 8. Check it yourself before the user does

Open the contact sheet: one frame per scene. Look for a ring on the wrong element or missing, a subtitle covering the thing being discussed, a scene on the wrong screen, a dev-tools badge or error toast in shot, real personal data. Pull single frames with ffmpeg where the sheet is too small to tell.

Then hand over the video with: its length, what changed from the approved narrative if anything, and anything you could not verify.

**When the user wants changes, go back to the narrative first.** Revise the table, show it, get the yes, then regenerate only what changed. Most feedback ("too fast", "I lost track of what changed", "also mention the filter") is feedback on the script, and fixing it in the recording alone produces a video that no longer matches its script.

### 9. Put things back

Undo what the take changed, using the list from step 3 and whatever the recording itself clicked: settings switched, items created or removed, demo accounts' state. Then tell the user what is restored and what you deliberately left (seed data they may want for the next video, for example). If something cannot be undone, say so.

## Files

Deliverables go together in one place the user can find, by default `walkthrough-videos/` in the project:

```
walkthrough-videos/
  03-add-a-task.mp4
  03-add-a-task.srt
  03-add-a-task.script.md
```

Keep the working files (`scenes.json`, audio, raw recording, the recording script) outside the repository or in a git-ignored folder. They are large, and the recording script holds selectors for one moment in the app's life. The script and `.srt` are worth keeping: they make the next revision a small edit.

## Things that go wrong

- **Native controls do not record.** A native `<select>` dropdown, a file picker or a browser dialog is drawn by the browser outside the page. Point at the control with `moveTo`, set the value with `selectOption` / `setInputFiles`, and let the narration say what was chosen.
- **The overlay disappears after navigation.** It is re-created on every page load and the current step and subtitle are restored. If a page replaces `document.body` wholesale, call `step()` again after it settles.
- **A scene starts before the page is ready.** Wait for the thing the scene is about (`await locator.waitFor()`) before calling `scene()`, not inside it, so loading time is not narrated over.
- **The first seconds are a blank page.** `mux.py` trims everything before the first scene. Do navigation and waiting before `scene('01')`.
- **Sign-in on camera.** Use the `login` option. Nobody needs to watch a password field, and credentials must not be visible in a shared video.

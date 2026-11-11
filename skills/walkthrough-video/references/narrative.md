# Writing the narrative

The narrative is the table the user reviews: one row per scene, with what is on screen and what the voice says. Everything downstream is generated from it, so the quality of the video is decided here.

## The table

```markdown
# 03 - Add a task (narration draft)

Status: DRAFT for review. Voice: Murf, en-US-natalie. Target length: about 30 seconds.

| # | On screen | Voice-over | ~sec |
|---|---|---|---|
| 1 | Task list at rest. Ring on the list. | This is the team task list. / Everyone on the team sees the same tasks. | 5 |
| 2 | Cursor to **Add task**, form opens. Type a name, click **Save task**. | To add one, select Add task, / give it a name, / and save. | 7 |
| 3 | Ring on the new task at the top. | The new task goes to the top of the list. | 4 |

Total: about 30 seconds.

## Notes for recording
- Account and environment used.
- What is highlighted, and anything that is opened but deliberately not clicked.
```

- **On screen** says what the viewer sees and what gets highlighted, in enough detail that the user can picture it. Bold the exact labels of controls.
- **Voice-over** is the spoken text. `/` splits it into subtitle lines.
- **~sec** is an estimate: about 2.5 words per second, plus a second for anything that has to load or animate.

## Writing for the ear

- One idea per scene. If a row needs "and then", it is two rows.
- Short sentences. The viewer cannot re-read, and the subtitle has to fit on one line: keep each `/` segment under about 45 characters.
- Say what to do with the words on the screen: "Select Add task, and give it a name", not "navigate to the task creation interface".
- Lead with what the viewer gets, then how. "Want it back? Open the menu, and choose Restore."
- Do not read out data that may differ between environments (item names, people's names, counts). Say "a task", and let the screen show which one. The script then survives a re-record on other data.
- Leave out greetings, "in this video" and sign-offs. Start on the first useful sentence and end on the last.
- Spell out anything a voice would stumble on: "S S O" reads better as "single sign-on"; write "version two" rather than "v2".

## Pacing

- A scene's actions should fit inside its narration. If three clicks happen while the voice says five words, the viewer misses two of them. Split the scene or give the voice more to say.
- The opposite failure is a voice that has finished while the cursor is still working. The recorder flags this as silence after the voice.
- When the user says "too fast", the fix is usually more scenes with less in each, not a slower voice.
- Give the viewer a moment on a result before moving on: a second or two with the ring on what changed.

## Showing a change: before and after

When an action changes what someone sees (a permission, a filter, a setting that affects another user), viewers lose track of what was there before. Do all three:

1. Show the "before" state and highlight the item that is about to change.
2. Make the change.
3. Show a before/after card with `card({ before, after })`, then the "after" state on the real screen.

Mark removed items with `{ text, mark: 'gone' }` and added ones with `{ text, mark: 'new' }`. Put the counts in the titles: "Before · 5 tasks", "After · 3 open tasks".

If the effect is on a different user, say whose screen it is every time the account changes, and keep the step label showing the name ("Lena's task list").

## Step labels

Group scenes into three to six steps and show "Step 2 of 4 · Save" bottom-left. It tells a viewer who looked away where they are. Several scenes share one step.

## Closing

End on a title card with the feature name and where to find it ("Tasks › Add task"), over a single short line. No call to action unless the user asked for one.

## Before you send it for review

- Every claim was observed in the running app in step 2.
- Every control named in the voice-over is spelled as it is on the screen.
- Total length is inside what the user asked for.
- Nothing in it names a real customer or a real person.

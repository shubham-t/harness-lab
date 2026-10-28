# Cue card: presenting the builder video

For the trimmed recording `presentation/video/harness-builder-live.trimmed.webm` (13:05, silent). The same sequence works on the live page (`http://127.0.0.1:4318/builder.html`) if you prefer to click "Run this step live" yourself; then the times do not apply and each step takes as long as the model takes.

The video is one continuous session recorded on 27 October 2026 with `cohere/north-mini-code:free`. Every step is a real run with real model calls; a one-second green title card marks each step. Times below are positions in the trimmed file (the untouched original and the time mapping are in `harness-builder-live.notes.txt`). Pause the video wherever you want to talk longer; the narration is yours, nothing is scripted in the recording.

## Before you start

- Open the video full screen. Keep `harness-builder-live.notes.txt` nearby for the run ids.
- One sentence to open: "A model alone cannot fix a bug in an app. We are going to build, piece by piece, the thing that lets it. Everything you will see is a real recorded run; every screen shows its run id and date."
- The three places to point at, on every step: the **request box** (the exact text sent to the model, new parts highlighted), the **activity list** (what happened, with a time on each line), and the **two phones** (sandbox where the agent works, production where users are).

## The steps

| Time | What is on screen | What to do | What to say |
| --- | --- | --- | --- |
| 00:01 | Title card, then step 0 "A model alone" | Pause after the card. Point at the request box and the empty diagram. | "We send the model the task and nothing else. This box is everything it receives." |
| 00:09 | The live button pressed; the status line counts the wait | Let it run. | "This is a real request going out now. Watch the counter." |
| 00:14 | Reply arrived: 3,759 tokens, a plan in prose | Pause. Scroll the reply if you like. | "A good plan. It even says it cannot see the files. Nothing changed. A model produces text." |
| 00:21 | Step 1 "Agent loop"; the first box turns blue | Pause on the problem text. | "One answer is a dead end. Something has to send the request again, report back what happened, and know when to stop." |
| 00:29 | Live run; the activity list grows: request, reply, observation | Let it run; point at the pattern. | "Request, reply, observation, again. That loop is the agent. There are no tools, so every observation says nothing changed." |
| 00:54 | Budget reached after 4 calls, 45,064 tokens | Pause. Point at the budget line. | "Four long replies and the budget is gone. A loop with nothing to act on just talks." |
| 01:01 | Step 2 "Tools and sandbox"; second box blue; the request box shows the tool list | Pause. Point at the highlighted lines. | "Now the loop can read and write files and click around the app, inside its own copy. These are the only things it can touch." |
| 01:09 | Live run: reads, one write to storage.js, then browser clicks | Let it run; point at the write and the sandbox phone. | "It read the files, changed the storage file once, and then tested by hand, click after click." |
| 02:46 | Budget reached after 23 calls; presenter evaluation 6/6 and 5/5 | Pause. Point at the evaluation block. | "The fix is correct. The checks I ran afterwards all pass. But it never said it was done. It tested until the money ran out." |
| 02:49 | The sandbox probe: a write outside the sandbox, rejected | Pause. | "This line is me, not the model. I asked the harness to write outside the sandbox. It refused." |
| 02:56 | Step 3 "Instructions and policies"; the rules block highlighted in the request | Pause. Scroll the highlighted block. | "Same loop, same tools. The highlighted block is new: the project's rules, sent with every request. This proves the rules were sent, not that they were obeyed. For that you read the diff." |
| 03:04 | Live run, same shape as step 2 | Let it run or skip ahead. | "Watch what changes: nothing in how it works. It still fixes the file and tests by hand." |
| 04:46 | Budget reached after 24 calls; 6/6 and 5/5 | Pause briefly. | "Correct again. Not finished again." |
| 04:52 | Step 4 "Context management"; a second block highlighted: files, sizes, revision, ticket | Pause. Point at the file list. | "Now the harness looks up the project for it: which files exist, which it may edit, what version it is on, and a note from the team." |
| 05:01 | Live run, same shape | Let it run or skip ahead. | "Same outcome. Three runs in a row wrote a correct fix and never finished. Nothing told them when to stop." |
| 06:37 | Budget reached after 23 calls; 6/6 and 5/5 | Pause. | Name the pattern out loud: "correct fix, no completion, three times." |
| 06:44 | Step 5 "Verification"; the request lists a new tool, run checks, and the gate sentence | Pause. Point at the highlighted lines. | "Now it can run the real checks, and it cannot finish until they pass on the current version of the code." |
| 06:52 | Live run: write, checks, completion, the harness's own check, applied | Let it run; point at the check results and then the production phone. | "It wrote the fix, ran the checks, asked to finish, and the harness checked once more by itself. Eleven calls. And look at production: it shipped by itself. No one approved it." |
| 07:48 | Completed; production banner "Updated automatically by the agent. No review." | Pause on the banner. | "That banner is the point of the next two steps." |
| 07:55 | Step 6 "Memory and state"; two columns, two runs | Pause on the problem text. | "Long work gets cut off. We set both runs to lose their whole conversation right after their first edit. One gets a saved handoff, one gets nothing." |
| 08:03 | Without memory runs first: reads, write, then the cut-off, then the fresh session starts from the task | Let it run; point at the reset line and the fresh session re-reading everything. | "Cut off. The new session knows nothing. It lists the files, reads them all again, runs the checks, then tests by hand until the budget ends." |
| about 09:50 | With memory runs: reads, a check, the write, the cut-off, then the fresh session with the handoff | Point at the handoff text. | "Cut off at the same point. This session is told which file was changed and what the last check said. It still re-reads the files, saves notes to itself, and runs out of budget." |
| 11:19 | Both finished: budget reached, 23 and 20 calls, both 6/6 and 5/5 | Pause. | "Both fixes are correct. Neither finished. A handoff carries state; it does not make the model stop. One pair tells us nothing about how often memory helps." |
| 11:26 | Step 7 "Guardrails: approval"; the last box blue; one highlighted line in the request | Pause. | "Everything so far could ship on its own. Now the change must wait for a person." |
| 11:34 | Live run: reads, write, checks, completion, then "Awaiting approval"; production banner "One change is waiting for your approval" | Let it run; point at the banner. | "Eleven calls, checks pass, and it stops. Production is still the original build." |
| 12:30 | The diff dialog: storage.js before and after | Pause. Scroll the "after" side. | "Only the storage file. The notes key is untouched. A separate draft key was added. That is what I would approve." |
| 12:36 | Approved; banner "Updated after your approval" | Pause on the banner. | "Only now does production change. The model never had the authority to ship." |
| 13:00 | The phones at the end | Stop the video. | Close: "Same model on every screen. It did not get smarter. We gave it a loop, tools, the rules, the context, checks it cannot skip, a memory across resets, and a person at the end." |

## Honest answers to likely questions

- **"Is this live?"** "It is a recording of real runs made on the 27th of October. Every screen shows the run id. The page behind it is live; I can start a run after the talk."
- **"Why did the rules and the context change nothing?"** "Because this task is small enough for this model. The harness still made every run inspectable, checkable, resumable and reviewable. On a harder task those inputs are where the model's knowledge runs out."
- **"Did memory help?"** "Not in this pair. The one with memory re-read the files anyway and ran out of budget. One pair is not a rate."
- **"Why did the first runs never finish?"** "Nothing told them when to stop. The acceptance tool in step 5 is what turned a correct patch into a finished run."
- **"What was cut from the video?"** "Waiting. Every moment where something changed on screen is in it. The untouched original is 23 minutes."

## If you present from the live page instead

Open `/builder.html` with the app running and a model connected. Press "Run this step live" on each step and narrate while the calls arrive; the status line shows the call count and elapsed time. Steps 1 to 4 run to their budget, about two to five minutes each with a free model. Step 7 stops at the approval boundary: open the diff, read it, then approve. Any provider failure is shown on the page; press the button again. Nothing is scripted, so narrate what you see, not what this card expects.

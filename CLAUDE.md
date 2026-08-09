# Working notes

How to work on this repo. `docs/DESIGN.md` covers what the game is and where
it is going; this covers how to change it.

## Check what else a change touches

A change is not done when the thing asked for works. It is done when you know
what else moved, and whether that was wanted.

Before calling anything finished, ask what else reads the type, the store
field, the node kind, the file you just edited — then go and look at it. Grep
for the other callers. A new field on `NodeSpec` is read by the roster, the
palette UI, the scoring pass and the level validator; a rename in `NodeKind`
touches every level JSON. If a change is mechanical, check what else the
pattern matched: a find-and-replace edits everything it matches, not
everything you meant.

Then say what moved. If a change reaches something outside the request, name
it in the reply and in the commit message, whether it turned out well or
badly. Nothing should be discovered by the person who asked, after the fact.

Two failure shapes this project is especially prone to:

- **Tuning a number is a gameplay change.** Capacity, base latency and cost
  are what make a level passable. Dropping `api_server.capacityRps` to make a
  demo look better can make level 1 unsolvable inside its budget. Any edit to
  the component roster means re-running every level's reference solution.
- **The engine has two clocks.** The sim advances in fixed `TICK_MS` steps and
  the renderer interpolates between them. A change that reads sim state from
  `useFrame`, or advances anything per frame, makes results depend on the
  player's refresh rate. It will look fine on the machine you tested on.

Verifying the change you made is not the same as verifying the change you
caused. Prove the second one too, and prove it on the thing that actually
governs the behaviour — a metric that looks right in the HUD can be right for
the wrong reason if the histogram it reads from is being fed twice.

## Ask instead of deciding

When a choice would change what a player sees, what a level demands, or what
the request covered, it is not yours to make. Ask.

Ask when:

- there is more than one reasonable reading of the request;
- the fix could be narrow or broad, and the broad one touches things nobody
  asked about;
- something else is found broken along the way — report it, do not quietly
  fix it, and do not quietly leave it either;
- a trade-off has to be struck between two things that are both wanted,
  especially simulation realism against teaching clarity;
- the tidy version of the change and the asked-for version are not the same
  change.

Carrying out the work asked for does not need a question at every step.
Picking a variable name, choosing which file a helper lives in, deciding how
to structure a test — get on with it. The line is whether the outcome changes
for the person who asked. If it does, ask first; a question costs a minute,
and an assumption costs a review cycle.

When you do ask, lay the options out with a recommendation, not an open-ended
"what would you like?". State the trade-off you see and which way you would
go.

## Branches and commits

- **Never put `claude` in a branch name.** Use a conventional prefix that says
  what the work is: `feat/`, `fix/`, `sim/`, `docs/`, `chore/`. If the harness
  hands this session a `claude/*` branch, rename it before pushing rather than
  working on it.
- Commits are authored as the repo owner, with no `Co-Authored-By` or
  `Claude-Session` trailers. Nothing in the history advertises the tooling.
- One commit per meaningful change, not one commit at the end. A branch that
  fixes three things should read as three commits, and each one should build
  and pass tests on its own.
- Write the commit message about the problem, not the patch. What was wrong,
  why it was wrong, and what the fix rests on. If a number was measured, put
  the number in — "p99 was 4.2s at 3k rps, now 280ms" beats "improved
  performance".
- A merged pull request is finished. Follow-up work starts a new branch from
  the updated default branch — never more commits on the merged one.

## Writing for the player

Everything a player reads teaches, or it is noise.

- Briefs are scenarios, not specifications. "Your app just hit the front page:
  100 → 8,000 req/s in two minutes" lands; "Configure a topology satisfying
  the constraints below" does not.
- Failure copy names the mechanism, never just the verdict. "Your database
  queued 12,000 requests and dropped 8% of them — a single primary caps your
  write throughput" is the whole point of the game. "Objective failed" wastes
  the moment the player was most ready to learn.
- Never leak the machinery. "Add a cache between the API servers and the
  database" is for the player; "node.capacityRps exceeded" is for the console.
- Do not overclaim accuracy. The numbers are tuned to teach the right
  intuition, not to predict real infrastructure. Copy must not imply the game
  models a specific cloud, product or price list.

## Verifying

Assume nothing behaves the way it reads.

- `npm run typecheck && npm run lint && npm test && npm run build` is what CI
  runs. Run all four before pushing; the build catches things the typecheck
  does not.
- Check anything visual in a real browser at a real viewport, with a
  screenshot. Chromium is at `/opt/pw-browsers/chromium` — pass it as
  `executablePath`. Do not run `playwright install`.
- Test the engine headless. Anything provable without a renderer belongs in a
  `src/sim/*.test.ts`, because those tests run in CI on every level. A
  gameplay claim that only holds when you watch it is not verified.
- Measure regressions rather than describing them. "p99 climbed from 180ms to
  2.4s once the third replica was removed" is worth more than "it got slower".
- Determinism is testable, so test it. The same topology and the same seed
  must produce the same metrics twice; if it does not, something is reading
  wall-clock time or frame time.

## Traps that have already cost time

- **`src/sim` may not import React or Three.js.** An eslint rule in
  `eslint.config.js` enforces it. This is the rule the project hangs on: it
  keeps the sim deterministic, unit-testable in Node, and lets CI verify every
  shipped level is solvable. If a sim file "needs" a Three.js type, the type
  belongs in `src/scene`, converted at the boundary.
- **The board camera's pitch is pinned deliberately.** `Board.tsx` locks
  `minPolarAngle` and `maxPolarAngle` to the isometric angle. Free pitch makes
  click-to-place ambiguous — you cannot tell which cell the cursor is over.
  Yaw and zoom are free on purpose; do not "fix" the lock.
- **`noUncheckedIndexedAccess` is on.** `arr[i]` is `T | undefined`. The
  non-null assertions in `src/sim/traffic.ts` are load-bearing and guarded by
  the length checks above them. Reach for a guard before reaching for `!`.
- **`@types/node` is a real dependency, not clutter.** `vite.config.ts` reads
  `process.env`, and `tsconfig.node.json` lists `node` in `types`. Removing it
  fails `tsc -b` with a message that points at the tsconfig, not the cause.
- **`base` in `vite.config.ts` is set for GitHub Pages** project-site hosting
  (`/3DSystemDesign/`). A root-domain deploy needs `BASE_PATH=/`, or every
  asset 404s in production while dev looks perfect.

## Levels and content

Levels live in `src/levels/` as plain data — a brief, an allowed palette, a
traffic profile and an `Objective`. Adding a level should mean adding a file,
never touching the engine or the renderer. If a new level cannot be expressed
in that shape, that is a signal about the engine, so raise it rather than
special-casing the level.

Every level needs a reference solution that CI can run and assert passes.
A level nobody has proved solvable is not shippable.

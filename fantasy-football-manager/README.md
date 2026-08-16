# Autonomous Yahoo Fantasy Football Manager

Watches free NFL news feeds, knows your league's scoring rules and roster, and
executes add/drop and waiver claims on its own. Trades are detected and
escalated to you — they are never executed autonomously.

Everything it uses is free: the Yahoo Fantasy Sports API (your own account) and
ESPN's public undocumented endpoints. No paid data services.

---

## What I need from you

Register the app at **https://developer.yahoo.com/apps/create/** and give me the
two credentials it produces.

| Field | What to enter | Why it matters |
|---|---|---|
| **Application Name** | anything, e.g. `FF Manager` | cosmetic |
| **Application Type** | **Web Application** | Installed Application does not issue a client secret, and this project needs the confidential OAuth flow |
| **Description / Home Page URL** | optional, leave blank | — |
| **Redirect URI(s)** | `https://localhost:8765/callback` | must match `YAHOO_REDIRECT_URI` byte for byte, and Yahoo requires `https` |
| **API Permissions** | tick **Fantasy Sports**, then select **Read/Write** | **Read alone will not work.** Add/drop, waiver claims and lineup changes all need write. This is the single most common setup mistake |
| **OpenID Connect Permissions** | leave off | not needed |

Click **Create App**. Yahoo then shows:

- **Client ID (Consumer Key)** — a long string
- **Client Secret (Consumer Secret)** — click to reveal

Put both in `.env`:

```bash
cd fantasy-football-manager
cp .env.example .env
# edit .env: YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET
```

That is the only credential work. Nothing else in the system needs a key —
ESPN's endpoints are open.

> **If Yahoo rejects `https://localhost:8765/callback`.** Some accounts refuse
> localhost redirect URIs. Register any https URL you control instead (it never
> has to actually load — `https://example.com/callback` works), put the same
> value in `YAHOO_REDIRECT_URI`, and authorise with
> `npm run auth -- --manual`. You will paste the redirect URL back into the
> terminal once; after that, refresh tokens keep it running indefinitely.

---

## Setup

```bash
cd fantasy-football-manager
npm install
npm run auth          # opens the Yahoo consent screen, stores tokens
```

`auth` prints your leagues at the end. Copy the key of the one you want into
`.env`:

```
YAHOO_LEAGUE_KEY=461.l.123456
```

Then confirm everything is reachable:

```bash
npm run doctor
```

`doctor` probes every Yahoo and ESPN endpoint this system depends on and prints
a pass/fail line for each. Because ESPN's API is undocumented and can change
without notice, **run this first whenever something looks wrong** — it will tell
you which specific endpoint broke rather than leaving the watcher silently
doing nothing.

Copy the strategy file if you want to tune anything:

```bash
cp config/strategy.example.json config/strategy.json
```

`strategy.example.json` documents every knob inline.

---

## Going live safely

`.env.example` ships with `DRY_RUN=1`. In dry-run mode every write is a no-op
that logs the exact XML it would have sent to Yahoo. Leave it on and watch a few
decisions first:

```bash
npm run plan          # what it would do right now, and the full reasoning
npm run watch -- --once   # one poll cycle end to end
```

When the decisions look right, remove `DRY_RUN` from `.env` and start the
watcher:

```bash
npm run watch
```

---

## How the waiver strategy works

This is the part that matters for your league, and it is why this is not just a
"grab the top free agent" bot.

You are in a **waiver priority** league with no FAAB. That makes the problem
completely different from the usual bidding question:

- A contested claim is decided by **priority number at the processing
  deadline**. Clicking faster does nothing.
- **Winning a claim sends you to the back of the queue.** Priority is a
  consumable resource with option value for the rest of the season.
- Once waivers clear, unclaimed players become **free agents, first come**.
  *That* is where speed wins, and it costs no priority at all.

So the real question is never "do I want this player" — it is **"do I want him
enough to spend priority, or can I wait 48 hours and take him for free?"**

The engine answers it with an explicit expected-value comparison
(`src/engine/waiver.ts`):

```
EV(claim) = P(win) × (value − priorityCost) + (1 − P(win)) × P(clears) × value
EV(wait)  = P(nobody claims) × value
```

- **`value`** — points per game gained over the player you would drop, times the
  games you expect to use him.
- **`P(win)`** — depends only on rivals holding *better* priority than you. If
  nobody active is ahead of you, you win with certainty.
- **`priorityCost`** — the option value you give up dropping to the back,
  decaying geometrically down the queue and linearly as the season runs out.
  Burning #1 in week 2 is expensive; burning #8 in week 13 is nearly free.
- **`P(clears)`** — the chance nobody claims him at all, so he reaches free
  agency where you can take him for nothing.

Rival behaviour is estimated from real signals, not assumed: which managers have
actually transacted in the last two weeks (`activeRivalLookbackDays`), and
Yahoo's rostered-percentage delta as a live measure of the wider platform
pouncing on someone.

Because only a couple of managers in your league are genuinely active, the model
is deliberately tuned to *let players clear* rather than reflexively claim.
`rivalPassivity` in `strategy.json` is the dial: raise it if the bot burns
priority on players nobody else wanted, lower it if you keep getting sniped.

Free agents are a separate path entirely — no EV maths, no priority at stake.
If the value clears the threshold, it adds immediately, because there speed is
the only thing that matters.

---

## Cold start

Valuation is normally driven by production, which is a problem in preseason and
week 1: nobody has scored anything, so every player values at zero, every pickup
looks like a zero-point upgrade, and the engine sits inert exactly when the wire
is most volatile.

So it carries a prior. Yahoo publishes each player's overall rank and rostered
percentage; `engine/baseline.ts` converts those into a *positional* rank across
the whole player universe — every rostered player plus the wire, because a free
agent who looks like the best receiver available might be WR55 overall — and
reads an expected points-per-game off a curve.

The curves are anchored to full PPR and adapted to your actual scoring, so a
standard-scoring league does not inherit PPR receiver numbers and a 6-point
passing-TD league values quarterbacks correctly.

Production then takes over gradually rather than flipping:

| Games played | Valuation is |
|---|---|
| 0 | entirely the preseason prior |
| 2 | an even blend |
| 4+ | entirely real production |

`productionRampGames` controls the crossover.

---

## Lineup optimisation

The highest-frequency decision in fantasy, and the safest thing to hand full
autonomy: lineup changes cost nothing, are fully reversible, and spend no waiver
priority. Leaving a player who was ruled out in your starting lineup is the most
common avoidable way to lose a week.

Slot assignment is solved **exactly** (Hungarian algorithm, `util/assignment.ts`)
rather than greedily. Greedy filling is genuinely wrong whenever flex slots
exist: taking the best available player for the flex spot can strand a dedicated
slot only he was eligible for. At roster sizes the exact solution is instant, so
there is no reason to approximate.

Players who are Out, on bye, or on IR value at zero through the normal path, so
they fall to the bench without needing a special case. Players whose game has
already kicked off are pinned to their current slot — Yahoo rejects moving them,
and the attempt fails the entire request rather than just that player.

```bash
ffm lineup            # what should change and why
ffm lineup --apply    # write it
```

Turn it off with `autoSetLineup: false` if you would rather set lineups yourself.

---

## Claim reconciliation

Filing a claim and never checking the result leaves the system blind in the way
that matters most. **If you win, your priority drops to last** — and every
subsequent claim decision computed against the old number is wrong.

Yahoo does not push results and a processed claim stops appearing as pending, so
reconciliation works by looking at where the player ended up: on your roster
(won), owned by a rival (lost), or still on waivers (not processed yet). Winning
triggers a fresh read of your real priority.

```bash
ffm claims
```

---

## The watchlist

This is what makes "wait for free agency" an actual strategy rather than a
decision to lose the player.

When the engine decides a claim is not worth burning priority, the player goes on
a watchlist with the exact moment he clears waivers. As that moment approaches
the watcher **tightens its poll interval from 90 seconds to 15** — free agents
are first-come, so a normal cycle is too slow to win one — and grabs him the
instant he is available.

```bash
ffm watchlist
```

---

## Guard rails

Autonomy makes the **drop** side the dangerous half of every transaction. A
player is droppable only if he clears every check in `src/engine/roster.ts`:

- Yahoo's own undroppable flag
- your `neverDrop` list
- not currently in your starting lineup
- would not breach a `positionFloors` minimum
- would not leave a starting slot unfillable (a real bipartite feasibility
  check, so a flex slot can never steal the only player eligible for a
  dedicated one)
- not inside the `minHoldHours` anti-churn window

On top of that: `maxTransactionsPerDay` caps autonomous moves, only the
highest-EV waiver claim is filed per run (winning one drops your priority
anyway), and stale news outside `maxNewsAgeMinutes` is ignored so a restart
cannot replay last week.

### Trades

The system now generates trade ideas as well as reacting to incoming offers. It
profiles every roster in the league for positional surplus and need — a fourth
good running back is worth far more to a manager starting a replacement-level
one than to the team hoarding him — and looks for swaps where **both** lineups
improve. A proposal the other manager would obviously reject is worse than no
proposal, so a candidate only survives if it helps them too, judged by the same
model.

```bash
ffm trades    # analysis only, nothing is sent
```

Everything about trades is alert-only, enforced structurally rather than by
convention:

1. A trade proposal files an **approval request** and stops.
2. You get an alert (console, `data/alerts.log`, and your webhook if set).
3. `ffm approvals approve <id>` mints a **single-use token** that expires in 24h.
4. Only that token unlocks Yahoo's trade endpoints.

There is no code path to Yahoo's trade endpoints without a valid token, the
token cannot authorise two trades, and setting `autoExecuteTrades: true` in
`strategy.json` is **rejected at load time**.

---

## Commands

```
npm run auth              Authorise with Yahoo (--manual for paste-back flow)
npm run doctor            Probe every endpoint and report status
npm run league -- list    List your leagues and keys
npm run league            Settings and full scoring breakdown
npm run roster            Your roster, valued under league scoring
npm run fa -- RB          Top available players, optionally by position
npm run plan              What it would do right now — no writes
npm run watch             The persistent loop
npm run watch -- --once   One cycle then exit (good for cron)
npm run approvals         Pending trade decisions
npm test                  Unit tests
```

Also available through the `ffm` binary after `npm run build`:

```
ffm lineup [--apply]      Best legal lineup, and what to change
ffm claims                Reconcile filed waiver claims
ffm watchlist             Players waiting to clear waivers
ffm trades                Trade ideas
ffm log                   Every transaction, with the reasoning recorded at the time
```

`ffm run` executes a plan once; `ffm log` shows every transaction the system has
made with the reasoning recorded at the time.

---

## MCP server

Exposes the whole system as MCP tools over stdio, in the same pattern as your
Amazon and Walmart servers.

```bash
npm run build
```

```json
{
  "mcpServers": {
    "yahoo-fantasy": {
      "command": "node",
      "args": ["/absolute/path/to/fantasy-football-manager/dist/mcp/server.js"]
    }
  }
}
```

**Read** — `list_leagues`, `get_league_settings`, `get_my_roster`,
`get_team_roster`, `list_free_agents`, `list_waiver_players`,
`list_available_players`, `get_players`, `get_player_stats`,
`get_waiver_priority`, `get_transactions`, `get_matchup`, `get_standings`,
`list_teams`, `get_nfl_news`, `get_nfl_injuries`, `get_activity_log`

**Decide** — `recommend_moves`, `evaluate_pickup`, `analyse_roster`,
`optimise_lineup`, `suggest_trades`, `get_team_profiles`

**Waiver lifecycle** — `reconcile_claims`, `get_watchlist`, `watch_player`,
`unwatch_player`

**Write** — `add_drop_player`, `drop_player`, `place_waiver_claim`,
`cancel_waiver_claim`, `set_claim_priority`, `set_lineup`,
`execute_recommended_moves`

**Trades (gated)** — `list_pending_trades`, `request_trade_approval`,
`propose_trade`, `respond_to_trade`, `list_approvals`

`evaluate_pickup` is the interesting one to drive by hand: give it a player key
and it returns the whole claim-vs-wait calculation, including what burning your
current priority actually costs.

---

## Architecture

```
src/
  yahoo/      OAuth 2.0, JSON normalisation, read layer, XML write layer
  espn/       Free public news, injuries, depth charts, scoreboard
  engine/     Scoring, valuation, roster safety, waiver EV, planning
  watcher/    Poll loop, event classification, notifications
  store/      Durable state, dedupe, rate ledgers, trade approvals
  mcp/        MCP server
  cli/        Command-line entry point
```

Two parts deserve a note:

**`yahoo/parse.ts`** — Yahoo's `format=json` is a mechanical translation of
their XML, so collections are objects with numeric string keys and entities are
arrays of single-key fragments meant to be merged. That normalisation is
isolated here and unit-tested against fixtures of the real shapes, including the
`transaction_data`-is-sometimes-an-object quirk.

**`util/names.ts`** — ESPN and Yahoo disagree constantly ("A.J. Brown" vs "AJ
Brown", "Patrick Mahomes II", `WSH` vs `WAS`). Matching is deliberately
conservative and returns *nothing* rather than a coin-flip guess, because acting
on the wrong player is worse than missing a pickup.

Scoring is never hardcoded. Yahoo hands over `stat_modifiers` (stat id → points
per unit) and player stat lines keyed by the same ids, so fantasy points are a
dot product — correct for PPR, half-PPR, 6-point passing TDs, return yardage, or
whatever else your commissioner set up.

---

## Known limitations

- **ESPN's endpoints are undocumented** and can change without notice. Every
  reader is defensive, and `npm run doctor` exists precisely so a breakage
  surfaces as a clear diagnostic instead of a silently idle watcher.
- **No projections feed.** Nothing free offers real weekly projections, so
  valuation blends season and trailing-month production under your scoring, plus
  a role-change bonus when news implies a promotion. It is a usage-and-role
  model, not a forecast. `roleChangeBonus` is the main dial.
- **Games played is approximated** from the current week, since Yahoo does not
  expose it directly. Players who missed time are slightly undervalued on the
  season component; the trailing-month component compensates.
- **The cold-start curves are anchored to typical output**, not to your league's
  history. They are deliberately conservative at the top — overpaying for a
  rank-1 projection is how a bot talks itself into burning waiver priority in
  week 1. Tune `roleChangeBonus` and `minValueAdded` if it feels too eager or too
  passive before real production accumulates.
- **Waiver clear times come from Yahoo's `waiver_date`**, which is a calendar
  date with no time attached. The exact moment is inferred from
  `waiverProcessingHour` (default 3am local). If your league processes at a
  different hour, set it, or the sprint window will open at the wrong time.
- **Depth-chart lookups cost one request per player** (ESPN returns `$ref`
  links), so they run only when a news item actually implicates a team, and
  results are cached for the process lifetime.

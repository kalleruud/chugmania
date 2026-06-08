# Trackmania Openplanet Capture Plugin — Implementation Plan (separate repo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A small Openplanet plugin for Trackmania 2020 that, during a local splitscreen or solo session, captures each player slot's best finish time per map visit and POSTs it to Chugmania's `/api/capture/heat` endpoint.

**Architecture:** AngelScript plugin reading the in-process game state each frame (`GetApp().CurrentPlayground` → `CSmArenaClient.Players` → `CSmScriptPlayer.RaceWaypointTimes`), tracking best finish per slot for the current map, and firing `Net::HttpPost` with a stable `heatId` on map end (plus a manual hotkey). Configuration (capture URL + token) via Openplanet settings.

**Tech Stack:** Openplanet (AngelScript), `Net::HttpRequest`. Runs on the gaming PC. Requires Openplanet **Developer mode** (TM Club Access ~$20/yr) to run unsigned, or plugin signing.

**Repo:** This is its own repository, NOT part of the Chugmania repo. The only coupling is the contract documented in the Chugmania repo at `docs/autocapture/capture-contract.md` (Plan 1, Task 9).

> **CRITICAL GATE — Task 0 must pass before Tasks 1–5.** The research flagged one genuine unknown: whether `CSmArenaClient.Players` enumerates *both* splitscreen slots in an offline local session, and exactly which members carry the slot index and finish time. Task 0 verifies this empirically and records the real field names. **If Task 0 shows only the primary player is visible, STOP** and switch to the replay-file-watcher fallback (see Appendix A) before writing the real plugin. Treat the API member names in Tasks 2–4 as "best known" until Task 0 confirms them.

---

## File structure

- `info.toml` — Openplanet plugin manifest.
- `src/Main.as` — entry points (`Main`, `Update`, `RenderMenu`), lifecycle.
- `src/Capture.as` — per-slot best-time tracking + heat assembly.
- `src/Net.as` — HTTP POST with retry.
- `src/Settings.as` — Openplanet settings (URL, token, hotkey, enabled).
- `README.md` — install, settings, Developer-mode/signing notes.

---

## Task 0: Feasibility spike (THE GATE)

**Files:**
- Create: `spike/info.toml`
- Create: `spike/Main.as`

- [ ] **Step 1: Minimal probe manifest**

Create `spike/info.toml`:

```toml
[meta]
name = "Chugmania Capture Spike"
author = "you"
category = "Utilities"

[script]
dependencies = []
```

- [ ] **Step 2: Probe that prints the player array each finish**

Create `spike/Main.as`:

```angelscript
void Update(float dt) {
    auto app = cast<CTrackMania>(GetApp());
    auto pg = cast<CSmArenaClient>(app.CurrentPlayground);
    if (pg is null) return;

    print("Players.Length = " + pg.Players.Length);
    for (uint i = 0; i < pg.Players.Length; i++) {
        auto player = cast<CSmPlayer>(pg.Players[i]);
        if (player is null) continue;
        auto sp = player.ScriptPlayer;
        string name = player.User !is null ? player.User.Name : "?";
        uint wpCount = (sp !is null) ? sp.RaceWaypointTimes.Length : 0;
        string last = wpCount > 0 ? "" + sp.RaceWaypointTimes[wpCount - 1] : "-";
        print("  slot " + i + " name=" + name + " wpCount=" + wpCount + " lastWp=" + last);
    }
}
```

- [ ] **Step 3: Install Openplanet + run the probe**

Install Openplanet on the gaming PC (Developer mode enabled). Drop the `spike/` folder into `OpenplanetNext/Plugins/`. Launch Trackmania → `LOCAL → LOCAL MULTIPLAYER → SPLITSCREEN`, 2 players, Time Attack, on any map. Open the Openplanet log (`~` / Openplanet → Log).

- [ ] **Step 4: Record the verdict + real field names**

Observe and write down in `spike/FINDINGS.md`:
- Does `Players.Length` equal **2** during 2-player splitscreen? (the crux)
- What distinguishes the slots — array index `i`, `player.User.Name`, or another member?
- After a player crosses the finish, does `RaceWaypointTimes` grow and is the last element the finish time in ms?
- Repeat for **hotseat** and **solo** (expect `Players.Length` 1).
- If any cast/member name above is wrong, note the correct one from the log/error (e.g. `ScriptPlayer` may need a different access path).

- [ ] **Step 5: Decision**

- **Both slots visible** → proceed to Task 1; carry the confirmed field names into Tasks 2–4.
- **Only one slot visible** → STOP. Go to Appendix A (replay-file watcher) and re-plan.

Commit the findings:

```bash
git add spike/
git commit -m "spike: verify Openplanet sees both splitscreen slots offline"
```

---

## Task 1: Plugin scaffold + settings

**Files:**
- Create: `info.toml`
- Create: `src/Settings.as`
- Create: `src/Main.as`

- [ ] **Step 1: Manifest**

Create `info.toml`:

```toml
[meta]
name = "Chugmania Capture"
author = "you"
category = "Utilities"
version = "0.1.0"

[script]
dependencies = []
```

- [ ] **Step 2: Settings**

Create `src/Settings.as`:

```angelscript
[Setting category="Connection" name="Enabled"]
bool S_Enabled = true;

[Setting category="Connection" name="Capture URL"]
string S_CaptureUrl = "http://localhost:6996/api/capture/heat";

[Setting category="Connection" name="Capture token" password]
string S_CaptureToken = "";

[Setting category="Connection" name="Manual send hotkey (VirtualKey)"]
VirtualKey S_SendKey = VirtualKey::F8;
```

- [ ] **Step 3: Main skeleton**

Create `src/Main.as`:

```angelscript
void Main() {
    print("Chugmania Capture loaded");
}

void Update(float dt) {
    if (!S_Enabled) return;
    CaptureUpdate(dt);
}

void OnKeyPress(bool down, VirtualKey key) {
    if (down && key == S_SendKey) {
        SendCurrentHeat("manual");
    }
}
```

- [ ] **Step 4: Verify it loads**

Reload plugins in Openplanet (`Ctrl+L`). Confirm "Chugmania Capture loaded" appears in the log and the Settings panel shows the Connection section.

```bash
git add info.toml src/Settings.as src/Main.as
git commit -m "feat: plugin scaffold + connection settings"
```

---

## Task 2: Per-slot best-time tracking

**Files:**
- Create: `src/Capture.as`

Use the field names **confirmed in Task 0** if they differ from below.

- [ ] **Step 1: Track best finish per slot for the current map**

Create `src/Capture.as`:

```angelscript
class SlotBest {
    int slot;
    int bestTimeMs = -1;
}

string g_currentMapUid = "";
string g_currentMapName = "";
string g_currentMapAuthor = "";
int g_playerCount = 0;
array<SlotBest@> g_bests;

SlotBest@ bestForSlot(int slot) {
    for (uint i = 0; i < g_bests.Length; i++) {
        if (g_bests[i].slot == slot) return g_bests[i];
    }
    SlotBest b;
    b.slot = slot;
    g_bests.InsertLast(b);
    return g_bests[g_bests.Length - 1];
}

void resetHeat() {
    g_bests = {};
    g_playerCount = 0;
}

void CaptureUpdate(float dt) {
    auto app = cast<CTrackMania>(GetApp());
    auto pg = cast<CSmArenaClient>(app.CurrentPlayground);
    if (pg is null) { return; }

    auto map = app.RootMap;
    if (map !is null) {
        g_currentMapUid = map.MapInfo.MapUid;
        g_currentMapName = map.MapInfo.Name;
        g_currentMapAuthor = map.MapInfo.AuthorNickName;
    }

    g_playerCount = pg.Players.Length;
    for (uint i = 0; i < pg.Players.Length; i++) {
        auto player = cast<CSmPlayer>(pg.Players[i]);
        if (player is null) continue;
        auto sp = player.ScriptPlayer;
        if (sp is null) continue;

        int finish = finishTimeOf(sp);
        if (finish > 0) {
            auto b = bestForSlot(int(i) + 1);
            if (b.bestTimeMs < 0 || finish < b.bestTimeMs) {
                b.bestTimeMs = finish;
            }
        }
    }
}

// Returns the finish time in ms if the player has crossed the finish, else -1.
// Confirm the exact finish signal during Task 0 (waypoint count == checkpoint
// total, or an isEndRace-style flag). The waypoint-array form is below.
int finishTimeOf(CSmScriptPlayer@ sp) {
    uint n = sp.RaceWaypointTimes.Length;
    if (n == 0) return -1;
    // Heuristic: treat the last waypoint as the finish only when the run is
    // complete; refine with the flag confirmed in Task 0.
    return int(sp.RaceWaypointTimes[n - 1]);
}
```

- [ ] **Step 2: Reload + sanity print**

Temporarily add `print("slot " + b.slot + " best " + b.bestTimeMs)` after a new best is recorded; race splitscreen and confirm best-times update and only improve. Remove the print.

```bash
git add src/Capture.as
git commit -m "feat: track best finish time per slot per map visit"
```

---

## Task 3: Heat-boundary detection + manual send

**Files:**
- Modify: `src/Capture.as`

- [ ] **Step 1: Detect map change and auto-send the previous heat**

Add to `src/Capture.as`:

```angelscript
string g_lastSentMapUid = "";
string g_activeMapUid = "";

void onMapMaybeChanged() {
    auto app = cast<CTrackMania>(GetApp());
    auto map = app.RootMap;
    string uid = map !is null ? map.MapInfo.MapUid : "";

    if (uid != g_activeMapUid) {
        // We left the previous map — flush its heat if it had any finishes.
        if (g_activeMapUid != "" && hasAnyFinish()) {
            SendCurrentHeat("mapEnd");
        }
        g_activeMapUid = uid;
        resetHeat();
    }
}

bool hasAnyFinish() {
    for (uint i = 0; i < g_bests.Length; i++) {
        if (g_bests[i].bestTimeMs > 0) return true;
    }
    return false;
}
```

Call `onMapMaybeChanged()` at the top of `CaptureUpdate(dt)` (before reading players).

- [ ] **Step 2: Generate a stable heatId per heat**

Add a heat identifier set when a map becomes active, so retries reuse it:

```angelscript
string g_heatId = "";

void newHeatId() {
    g_heatId = "" + Time::Stamp + "-" + Math::Rand(1000, 9999);
}
```

Call `newHeatId()` inside `onMapMaybeChanged()` right after `resetHeat()`.

- [ ] **Step 3: Reload + verify the boundary**

Race a map in splitscreen, finish both, then change map. Confirm (via a temporary log line in `SendCurrentHeat`, built in Task 4) that exactly one heat fires on map change, and the manual hotkey fires on demand.

```bash
git add src/Capture.as
git commit -m "feat: heat-boundary detection + stable heatId + manual flush"
```

---

## Task 4: Build payload + POST with retry

**Files:**
- Create: `src/Net.as`
- Modify: `src/Capture.as`

- [ ] **Step 1: HTTP POST with retry**

Create `src/Net.as`:

```angelscript
void PostHeat(const string &in jsonBody) {
    startnew(function(ref@ r) {
        string body = cast<StringRef>(r).value;
        for (int attempt = 0; attempt < 3; attempt++) {
            auto req = Net::HttpPost(S_CaptureUrl, body, "application/json");
            req.Headers["Authorization"] = "Bearer " + S_CaptureToken;
            while (!req.Finished()) { yield(); }
            int code = req.ResponseCode();
            if (code == 200) {
                print("Capture sent: " + req.String());
                return;
            }
            print("Capture POST failed (" + code + "), attempt " + (attempt + 1));
            sleep(1000);
        }
    }, StringRef(jsonBody));
}

class StringRef { string value; StringRef(const string &in v) { value = v; } }
```

> **Verify during implementation:** the exact way to set request headers (`req.Headers[...]` vs building a `Net::HttpRequest` manually and calling `Start()`) per the installed Openplanet version. If `Net::HttpPost` doesn't expose settable headers pre-send, construct a `Net::HttpRequest`, set `Method='POST'`, `Body`, `Headers`, then `Start()`.

- [ ] **Step 2: Assemble + send the heat JSON**

Add to `src/Capture.as`:

```angelscript
void SendCurrentHeat(const string &in reason) {
    if (g_currentMapUid == "" || !hasAnyFinish()) return;
    if (g_heatId == "") newHeatId();

    Json::Value@ payload = Json::Object();
    payload["contractVersion"] = 1;
    payload["heatId"] = g_heatId;
    payload["mapUid"] = g_currentMapUid;
    payload["mapName"] = g_currentMapName;
    payload["mapAuthor"] = g_currentMapAuthor;
    payload["playerCount"] = g_playerCount;

    Json::Value@ results = Json::Array();
    for (uint i = 0; i < g_bests.Length; i++) {
        if (g_bests[i].bestTimeMs <= 0) continue;
        Json::Value@ r = Json::Object();
        r["slot"] = g_bests[i].slot;
        r["bestTimeMs"] = g_bests[i].bestTimeMs;
        results.Add(r);
    }
    payload["results"] = results;

    PostHeat(Json::Write(payload));
    print("Heat sent (" + reason + "): " + g_heatId);
}
```

- [ ] **Step 3: Reload + verify end-to-end against a running backend**

With the Chugmania backend running (active session set, `CAPTURE_TOKEN` configured), race splitscreen → change map → confirm a faded row pair appears in Chugmania. Then test the `F8` manual send.

```bash
git add src/Net.as src/Capture.as
git commit -m "feat: assemble heat payload + POST to Chugmania with retry"
```

---

## Task 5: Manual test protocol + packaging

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the manual test matrix**

Verify and tick each:
- Solo (1 player): one finish → one-slot heat → one faded row in Chugmania.
- 1v1 splitscreen: two finishes → two-slot heat → linked faded rows; faster slot wins after assignment.
- Best-of-retries: multiple finishes per slot → only the fastest is sent.
- Map change auto-flush: exactly one heat per map visit.
- Backend down: POST retries 3× then logs failure; bringing the backend up and pressing `F8` re-sends with the same `heatId` (idempotent — no duplicate row).
- No active session in Chugmania: POST returns `{stored:false}`; nothing appears (correct).

- [ ] **Step 2: README**

Create `README.md`: install path (`OpenplanetNext/Plugins/`), the four settings, the Developer-mode requirement (or signing), and a link to the Chugmania contract doc. State the supported modes (splitscreen + solo + hotseat) and that capture only happens while a Chugmania session is active.

- [ ] **Step 3: Commit + tag**

```bash
git add README.md
git commit -m "docs: install + test protocol; v0.1.0"
git tag v0.1.0
```

---

## Appendix A: Replay-file watcher fallback

Use ONLY if Task 0 shows splitscreen slots are not enumerable.

- Run the existing **Autosave Ghosts** Openplanet plugin to force a `.Replay.gbx` per finished run into
  `Documents/Trackmania/Replays/AutosavedGhosts/<Map>/<Date>-<Map>-<Nick>-<RaceTime>.Replay.gbx`.
- A small Node watcher (its own repo, using `chokidar`) parses new files with **GBX.NET** (`Gbx.LZO = new Lzo()`, `CGameCtnGhost.RaceTime` + nickname) — or, simpler, parses the **filename** which already embeds nickname + race time.
- It then POSTs the same `/api/capture/heat` payload. Note: splitscreen per-slot ghost saving is unverified — confirm during the fallback's own spike. This path is non-real-time (fires after the run is written).

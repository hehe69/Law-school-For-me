# Command Overhaul (Stellaris 4.4.6) - fix report

Fixed mod: `stellaris/command_overhaul/` in this repo (also delivered as `command_overhaul_fixed.zip`).
Original, untouched upload: git commit `5cb0485` ("pre-fix baseline backup").
Changed files (4): `common/armies/ugf_roster.txt`, `common/armies/ugf_spawned.txt`,
`common/on_actions/ugf_on_actions.txt`, `events/ugf_guard_events.txt`. Nothing else was touched;
no file was deleted; all stats, unit keys and localisation are unchanged; `{ }` balance verified.

## 0. Read this first: what I could and could not verify

This session ran in a Linux cloud container, not on your Mac. The paths you gave
(`~/Library/Application Support/Steam/...`, `~/Documents/Paradox Interactive/Stellaris/logs/error.log`,
the workshop folder) do not exist here, so I could not open the 4.4.6 game files, your error.log or NSC3.
Rather than guess, I verified against the closest real sources I could reach:

| Source | What it is | Used for |
|---|---|---|
| `gitlab.com/stellaris/game` (commit `92b655ce`, "3.6.1 (a6c5)") | Full vanilla text, last mirrored at 3.6.1 | Exact army / building / job / on_action syntax and idioms. Line numbers below cite these 3.6.1 files. |
| `cwtools-stellaris-config/config/logs/trigger_docs.log`, `modifiers.log`, `scopes.log` | The game's own `script_docs` output, 4.x generation (they contain the 4.0+ `pop_group` scope) | Which triggers/effects exist in 4.x, their scopes, and which modifiers and building IDs exist in 4.x |
| `cwtools-stellaris-config/config/common/armies.cwt`, `events.cwt`, `Stellaris on_actions.csv` | Community schema of valid keys, maintained for current versions | Valid army keys, valid event keys, on_action scopes |
| `gitlab.com/stellaris/game` at 2.1.3 (commit `b98d0ed1`) | Pre-job-era vanilla | How defensive armies were kept non-recruitable before `is_pop_spawned` existed |

So: syntax idioms are verified against real vanilla text, and every 4.4-specific ID I rely on is verified against
the 4.x docs, but the 4.4.6 files themselves were not read. Section 5 lists the handful of things you should confirm
with one grep each before trusting the result 100%.

Backup: the original upload is preserved in git. On your Mac, before copying the fixed files in, run
`cp -R ~/Documents/Paradox\ Interactive/Stellaris/mod/command_overhaul ~/Documents/Paradox\ Interactive/Stellaris/mod/command_overhaul_backup_$(date +%Y%m%d)`.

## 1. Step 1: what vanilla says

### a) Recruitable vs pop-spawned keys; `defensive`, `can_retreat`, `is_pop_spawned`

The full valid key list for an army (cwtools `armies.cwt` lines 34-129): `resources`, `army_modifier`,
`use_armynames_from`, `defensive`, `is_building_spawned`, `is_pop_spawned`, `damage`, `health`, `has_morale`,
`morale`, `morale_damage`, `collateral_damage`, `war_exhaustion`, `icon`, `has_species`, `time`, `pop_limited`,
`disband_if_species_lacks_rights`, `rebel`, `occupation`, `prerequisites`, `show_tech_unlock_if`, `potential`,
`potential_country`, `allow`, `on_queued`, `on_unqueued`, `spawn_chance` (pop-spawned only), `ai_weight`.

- `can_retreat` is **not** an army key. It appears nowhere in that list, nowhere in any vanilla army file
  (3.6.1 `00_defense_armies.txt`, `01_assault_armies.txt`, `02_event_armies.txt`, `03_occupation_armies.txt`),
  and nowhere in the 4.x trigger/effect docs. The generator invented it. Removed.
- A recruitable army in vanilla (3.6.1 `01_assault_armies.txt` lines 8-83, `assault_army`) has: stats, `time`,
  `icon`, `prerequisites`, `resources { category cost upkeep }`, `show_tech_unlock_if`, `potential_country`,
  `potential`, `ai_weight`. Optional `allow` (slave_army lines 109-126).
- A pop-spawned defensive army (3.6.1 `00_defense_armies.txt` lines 10-47, `defense_army`) has:
  `defensive = yes` (line 11), `is_pop_spawned = yes` (line 12), stats, `icon`, `resources` with upkeep/produces
  only (no cost, no time), `potential`. `is_pop_spawned = yes` is what makes it spawn from jobs instead of being
  buildable; the file header (lines 4-7) documents this and `spawn_chance`.
- `defensive = yes` by itself only means "cannot leave the planet" (file header line 1 of every army file:
  "Defensive armies can't transport off the planet"). Evidence that it does **not** by itself block recruitment:
  at 2.1.3 (pre-jobs), vanilla had to add a separate key, `is_building_spawned = yes` (2.1.3
  `00_defense_armies.txt` line 9, header line 4: "building spawned armies can't be built normally"), to keep
  `defensive = yes` armies out of the build list. If `defensive` alone did that, that key would be pointless.
  Vanilla also has `defensive = yes` armies that carry `time` and upkeep (`rebel_slave_defense_army`
  lines 20-31, `titanic_guardian_army` lines 355-375 of `02_event_armies.txt`), which only stay unbuildable
  because of `potential_country = { always = no }`.
  **Caveat:** vanilla has no army that is both `defensive = yes` and actually offered for recruitment, so I
  could not point at a working example. Checklist step 1 tests this in 30 seconds and the rollback is five lines.

### b) How capitals, strongholds and fortresses produce defense armies

Through jobs, not through a building-level `planet_defense_armies_add`. In 3.6.1 no building anywhere carries
`planet_defense_armies_add` (grep over all 17 building files: zero hits). Instead:

- `building_stronghold` (3.6.1 `09_army_buildings.txt` line 156) gives `job_soldier_add = @b1_jobs` (line 172);
  `building_fortress` (line 219) gives `job_soldier_add = @b2_jobs` (line 237).
- `building_capital` / `building_major_capital` / `building_system_capital` (3.6.1 `00_capital_buildings.txt`
  lines 100, 350, 636) give `job_enforcer_add = 1 / 2 / 3` (lines 150, 395, 682). They give **no** soldier jobs.
- The jobs carry the army modifier. 3.6.1: `soldier` (`03_worker_jobs.txt` line 647) has
  `pop_modifier = { pop_defense_armies_add = 3 }` (line 674); `enforcer` (`02_specialist_jobs.txt` line 315)
  has `pop_defense_armies_add = 2` (line 351); even `colonist` has `pop_defense_armies_add = 1` (line 20).
- In 4.x the per-pop modifier is gone (`modifiers.log`: zero hits for `pop_defense_armies_add`) and the
  job-level modifier is `planet_defense_armies_add` (`modifiers.log` line 269), scaled by workforce. The 4.x
  wiki text confirms the design: "Defensive armies only exist if enforcers or soldier jobs are crewed. A
  Stronghold adds them, and its upgrade, the Fortress, adds more."

**This is the mechanism behind your core bug.** Every capital building supplies enforcer jobs, enforcers supply
defense-army slots, and the mod's `defense_army` override (Planetary Guard) had no planet condition, so every
colony with a crewed enforcer job filled those slots with Planetary Guards.

### c) How the game picks among several valid pop-spawned armies; scope of `potential`

- Selection: vanilla's own comment, 3.6.1 `00_defense_armies.txt` lines 6-7: "spawn_chance: only works on
  defensive armies; pop scope check that lets you give weights for what sort of army should be spawned.
  Calculation is health * spawn_chance (default: 1), and it always picks the best one." Vanilla keeps its types
  mutually exclusive mainly through `potential` (organic vs `trait_mechanical` vs `trait_machine_unit` species,
  machine vs non-machine owner, lines 31-46, 113-120, 151-156) and uses `spawn_chance = { factor = 100 }`
  (lines 95-97) to make `undead_defense_army` win outright where it is valid.
- Scope: `potential` of a pop-spawned army is evaluated in **planet** scope with `from` = the species.
  cwtools `armies.cwt` line 33: `replace_scope = { this = planet root = planet from = species }`. Vanilla usage
  agrees: `from = { has_trait ... is_sapient = no }` (lines 32-38), `owner = { ... }` (line 39),
  `planet = { has_active_building = building_dread_encampment ... }` (lines 70-81, `undead_defense_army`),
  and `has_building = building_offspring_nest` directly at top level plus `planet.owner = { ... }`
  (lines 192-200, `offspring_defense`).
- So yes, `has_building = X` works directly at top level there (4.x `trigger_docs.log` line 1224-1227:
  `has_building`, Supported Scopes: planet). The vanilla idiom for gating a spawned army on a building is
  `planet = { has_active_building = X }` (`has_active_building`: "not disabled or ruined",
  `trigger_docs.log` lines 1233-1235). I mirrored that.
- Recruitable armies use the same scopes: `potential` / `allow` are planet scope with `from` = species
  (`slave_army` `allow` uses `has_building` and `any_owned_pop` at top level, lines 109-126; `undead_army`
  gates on `planet = { has_active_building = ... }`, lines 609-615; `cybrex_warform` uses
  `planet = { is_capital = yes }`, lines 484-488). `potential_country` and `show_tech_unlock_if` are country
  scope (`armies.cwt` lines 89-101).

### d) `on_monthly_pulse` and on_action merging

- 3.6.1 `00_on_actions.txt` line 44-45: `# No scope, like on_game_start` / `on_monthly_pulse = {`. Everything
  listed there is a scopeless `event` (e.g. `marauder.511` is `event = {`, `marauder_events.txt` line 7685).
- Line 162-163: `# this = country` / `on_monthly_pulse_country = {`, and its list is country events
  (e.g. `origin.3230` is `country_event = {`, `origin_events_3.txt` line 541; `clones.3` line 168).
- The cwtools 4.x `Stellaris on_actions.csv` confirms both still exist with the same scopes
  (line 3: `on_monthly_pulse ... scopeless`; line 12: `on_monthly_pulse_country, root = country this = country`).
- The mod hooked a `country_event` to the **scopeless** pulse. That is why `ugf_guard.1` never fired.
- Merging: `99_README_ON_ACTIONS.txt` line 31 says on_actions cannot be created from script, only fed events;
  vanilla itself spreads on_action content over several files (`00_on_actions.txt`, `01_planet_destruction.txt`).
  Same-name blocks from different files have their `events` lists appended; this is the standard behavior every
  on_action mod relies on. No vanilla file states it in so many words, so it stays "established behavior" rather
  than a quoted line.

### e) error.log

Not reachable from this session. Run this on the Mac and send me the output if anything shows up:

```
grep -n "ugf_\|ugf_guard" ~/Documents/Paradox\ Interactive/Stellaris/logs/error.log | grep -v "is_infernal\|_uncapped\|building_private_"
```

Expected after the fix: nothing. Before the fix, I would expect complaints about `can_retreat`, `hidden`, and
`building_habitat_capital` (none of the three exists).

## 2. Step 2/3: the six behaviors

### 1. Civil Defense Militia (`ugf_civil_militia`, `_s1`, `_s2`)
- Wrong: `can_retreat = no` (invalid key). Gates were already correct and mutually exclusive
  (base: neither building; s1: stronghold and not fortress; s2: fortress), so together they cover every planet.
- Changed: `can_retreat = no` -> `defensive = yes` (planet-locked). Nothing else.
- Evidence: 1a above. If step 1 of the checklist shows the militia missing from the recruit list, delete the
  five `defensive = yes` lines (three militia, two guards) and they become ordinary recruitable units.

### 2. Republican Guard / Imperial Guard
- Wrong: `can_retreat = no`. The capital gate `planet = { is_capital = yes }` was already the vanilla idiom
  (`cybrex_warform`, 3.6.1 `02_event_armies.txt` lines 484-488; `is_capital` is planet scope,
  `trigger_docs.log` line 1033-1035). Ethic gates untouched.
- Changed: `can_retreat = no` -> `defensive = yes`.

### 3. Infantry and the building gates
- Wrong: `ugf_infantry` had **no** building requirement at all (only the species check), so it was recruitable
  everywhere. All other units already had their gates.
- Changed: added the same `OR = { planet = { has_building = building_stronghold } planet = { has_building = building_fortress } }`
  block that `ugf_garrison`, `ugf_incendiary`, etc. already use.
- Building IDs verified in the 4.x `modifiers.log` (the game auto-generates one
  `planet_<building>_build_speed_mult` modifier per building, so the list is a complete census):
  `building_stronghold` (line 7566), `building_fortress` (7567), `building_clone_vats` (7408),
  `building_medical_1/2/3` (7519-7521). `building_clinic` / `building_hospital` from 3.x no longer exist, so the
  Supersoldier gate on `building_medical_2/3` is right for 4.x.
  `building_navel_base` / `building_navel_command` are not vanilla (expected, they are NSC3); confirm their
  spelling with the grep in section 5.

### 4. Planetary Guard (`defense_army` override)
- Wrong: no planet condition, so enforcer jobs from every capital building spawned it everywhere (see 1b).
- Changed: added `planet = { OR = { has_active_building = building_stronghold has_active_building = building_fortress } }`
  at the top of `potential`, mirroring `undead_defense_army` (3.6.1 `00_defense_armies.txt` lines 70-81).
  Count still comes from the planet's defense-army slots (soldier and enforcer jobs), so more soldier jobs give more
  Planetary Guards, and planets without a stronghold/fortress get none.
- Unchanged by design: `robotic_defense_army` / `machine_defense` from vanilla still spawn for robot pops
  and machine empires on any planet. Say so if you want them gated too.

### 5. Capital Guard (`ugf_capital_guard`) - the event never fired
Three independent faults, each fatal on its own:
1. Hooked to the scopeless `on_monthly_pulse`; a `country_event` needs `on_monthly_pulse_country` (1d).
   Fixed in `ugf_on_actions.txt`.
2. `hidden = yes` is not a Stellaris event key; the key is `hide_window = yes` (cwtools `events.cwt` line 527;
   3.6.1 events use `hide_window = yes` 1277 times and `hidden = yes` zero times).
3. `building_habitat_capital` does not exist; the habitat tier-1 capital is `building_hab_capital`
   (`modifiers.log` line 7390; 3.6.1 `00_capital_buildings.txt` line 1724). The other six IDs are valid
   (`modifiers.log` lines 7381-7383, 7391-7392, 7397).

I kept the event design (you asked for exact 2/4/6) but replaced the one-shot planet flags with a monthly top-up:
each colony with a capital building is brought up to its tier target by counting the `ugf_capital_guard` armies
already on it (`count_planet_army`, planet scope, `trigger_docs.log` lines 3604-3608; `army_type`, army scope,
lines 1285-1287; bounded `while = { count = N }`, lines 7793-7796; `if/else_if/else`, lines 6494-6497, 8251-8254;
`create_army`, planet scope, lines 4901-4908; `species = root.species` is valid because `species` links from
country scope, `scopes.log` lines 42-44). Why: with flags, guards killed in an invasion never came back, a
conquered planet never granted guards to its new owner, and an existing save with stale flags would be stuck.
With the top-up, the event is idempotent, works on an existing save at the next month tick, and re-raises lost
guards one tier-batch at a time. AI empires get the same treatment (the pulse fires for every country).

Pop-spawn alternative, as you asked me to weigh it: making `ugf_capital_guard` `is_pop_spawned = yes` with a
capital-building `potential` and `spawn_chance = { factor = 100 }` would make it win every defense-army slot on
a planet that has both a capital and a stronghold (the picker takes one best type per slot, 1c), so you cannot
get "Capital Guards from the capital and Planetary Guards from the stronghold" on the same planet, and the count
would be job-driven (enforcers plus soldiers), not 2/4/6. The event is the only way to get your spec. Not done.

### 6. Visibility for a standard empire
Every recruitable unit's `potential_country` has the `NOR` block you wrote, so a standard empire sees them, but
**Feudal Society, Toxic Knights origin, Corporate Dominion, Merchant Guilds, any Corporate authority, Machine
Intelligence, and bio-ship empires see none of the organic roster** (machine units have their own
`potential_country`). Kept as designed; flagged as requested.

Note also that `is_machine_empire`, `is_gestalt`, `is_wilderness_empire` and `country_uses_bio_ships` are not
engine triggers (zero hits in `trigger_docs.log`); the first two are vanilla scripted triggers (3.6.1
`00_scripted_triggers.txt` lines 1220, 1228) and the last two are presumably 4.0 scripted triggers. Section 5
has the grep to confirm the last two exist in 4.4.6.

## 3. Exact diff

```
ugf_roster.txt     : 5x  "can_retreat = no" -> "defensive = yes"  (militia x3, republican guard, imperial guard)
                     ugf_infantry.potential: + OR { stronghold | fortress } gate
ugf_spawned.txt    : defense_army.potential: + planet = { OR { has_active_building stronghold | fortress } }
ugf_on_actions.txt : on_monthly_pulse -> on_monthly_pulse_country
ugf_guard_events.txt: hidden -> hide_window; building_habitat_capital -> building_hab_capital;
                     flag-based one-shot grants -> monthly top-up to 2/4/6 (same id, same army name key)
```
`git diff 5cb0485 HEAD -- stellaris/command_overhaul` shows every changed line.

## 4. In-game verification checklist

Enable the console with `~` (or the key your layout uses). Select a planet by clicking it before running any
`effect` command; `effect` runs in the scope of the selected object.

1. **Recruit list and planet-lock (do this first).** Open your capital, Armies tab, recruit list.
   Expect: Civil Defense Militia (100 days), and Republican or Imperial Guard if your ethics qualify.
   Do **not** expect Infantry, Garrison, Motorized, etc. unless the capital already has a Stronghold.
   If the militia is missing, `defensive = yes` is hiding it: delete the five `defensive = yes` lines in
   `ugf_roster.txt` and tell me. Recruit one militia and let it finish: it should land in the planet's army list
   and have no transport/embark option.
2. **Building gates.** With the capital selected: `effect add_building = building_stronghold`.
   Expect the base militia to vanish and the 50-day militia, Infantry, Garrison, Incendiary, Special Forces
   (with its tech), Motorized, Mechanized, Armor, Fighter/CAS/Bomber (with techs) to appear.
   `effect add_building = building_clone_vats` with Cloning researched: clone units appear.
   `effect add_building = building_medical_2` with Gene Tailoring: Supersoldiers appear.
   On an NSC3 Naval Base world: Marines, ODST, All Terrain.
3. **Capital Guard event.** `event ugf_guard.1` (fires for your empire). Open any colony with a capital
   building, Armies tab: 2 "Capital Guard" at Planetary Administration, 4 at Major, 6 at System/Imperial, habitats
   included. Run `event ugf_guard.1` again: the counts must not grow (top-up, not add). Then simply unpause for a
   month: the pulse must do the same without the console.
4. **Direct army test** (bypasses the event; proves the army type itself is sound). Select a planet, then:
   ```
   effect create_army = { name = "ugf_capital_guard_army_name" owner = owner species = owner_main_species type = ugf_capital_guard }
   ```
   One "Capital Guard" appears immediately. (That is the planet-scope form; `owner = root` in the event is correct
   there because root is the country in a `country_event`.)
5. **Planetary Guard.** A colony **without** Stronghold/Fortress: after a month, no "Planetary Guard" armies,
   even though the planet summary may still show defense-army slots from enforcers. A colony **with** a crewed
   Stronghold: Planetary Guards appear, count matching the planet's defense-army figure; a Fortress or a
   military-specialized zone with more soldier jobs raises it. Build/remove with `effect add_building = ...`
   and `effect remove_building = building_stronghold`.
6. **Log.** After one in-game month, run the grep from 1e. Expect no new `ugf_` lines.

## 5. Confirm on the Mac (one grep each, paths from your message)

```
V=~/Library/Application\ Support/Steam/steamapps/common/Stellaris/common
grep -rn "^on_monthly_pulse_country" "$V/on_actions/"                               # must exist
grep -rln "^building_hab_capital = {\|^building_medical_2 = {\|^building_clone_vats = {" "$V/buildings/"   # must list files
grep -rn "^is_wilderness_empire = {\|^country_uses_bio_ships = {" "$V/scripted_triggers/"                  # must exist
grep -rn "planet_defense_armies_add" "$V/pop_jobs/" | head                                                # soldier/enforcer carry it
grep -rn "^building_navel_base = {\|^building_navel_command = {" ~/Library/Application\ Support/Steam/steamapps/workshop/content/281990/683230077/common/buildings/
```
If the NSC3 grep prints nothing, send me `grep -rhn "^building_[a-z_]*nav[a-z_]* = {" <that folder>` and I will
correct the three Marine/ODST/All-Terrain gates.

## 6. Existing save or new game?

Your existing save is fine. Army definitions, events and on_actions are read from files on load, nothing is
baked into the save. Two things to expect on first load: the Capital Guards appear at the next monthly tick
(or immediately with `event ugf_guard.1`), and Planetary Guards that already spawned on non-stronghold planets
may or may not be disbanded automatically. If they linger and you want them gone, select the planet and run
`effect every_planet_army = { limit = { army_type = defense_army } remove_army = yes }`
(`remove_army`, army scope, `trigger_docs.log` lines 7822-7824).

## 7. Optional, lowest priority: the inherited-roster log noise

`ugf_inherited.txt` references `is_infernal` (a scripted trigger from the mod it was lifted from),
`district_farming_uncapped` and `building_private_*` (IDs that do not exist in your game). Those errors cannot
be silenced by wrapping; the only clean options are (a) a stub scripted trigger file
`common/scripted_triggers/ugf_stubs.txt` with `is_infernal = { always = no }`, plus replacing the two unknown IDs
with valid ones, or (b) removing the units that use them. Both change files you told me to leave alone, so I
have not touched them. Say the word and I will do (a).

# Casino Games — Verified Rules, Payouts & House Edge (Source of Truth)

> Primary source: **Wizard of Odds** (wizardofodds.com), each corroborated by a second reputable source.
> Payout notation is **X:1 (to-one, net profit; stake returned on top)**. If an engine pays "for one"
> (stake included), subtract 1. Incorrect payouts silently invalidate any experiment — treat this file
> as authoritative and cross-check the code against it.

---

## 1. ROULETTE

Layouts: **European** single-zero (37 pockets: 0, 1–36), **American** double-zero (38 pockets: 0, 00, 1–36).
Payouts identical on both wheels; only the extra `00` changes the edge.

| Bet | Numbers | Payout |
|---|---|---|
| Straight-up | 1 | 35:1 |
| Split | 2 | 17:1 |
| Street | 3 | 11:1 |
| Corner / Square | 4 | 8:1 |
| Six-line / Double street | 6 | 5:1 |
| Column | 12 | 2:1 |
| Dozen | 12 | 2:1 |
| Red/Black | 18 | 1:1 |
| Odd/Even | 18 | 1:1 |
| High/Low (1–18 / 19–36) | 18 | 1:1 |
| Five-number (American only) | 0,00,1,2,3 | 6:1 |

House edge: **European 2.70%** (1/37), **American 5.26%** (2/38). American five-number bet = **7.89%** (worst bet).

**Table minimums** (this simulation, mirrors the Sic Bo convention): outside even-money bets
(Red/Black/Odd/Even/High/Low) **50**; every other bet (straight/split/street/corner/sixline/
column/dozen/five) **10**. Enforced by the adapter — a stake below its bet's minimum is refused,
as is a split/street/corner/sixline whose numbers don't form a real cell/line/corner on the felt.

**La Partage / En Prison** (single-zero French tables, even-money bets only, when ball hits 0):
- La Partage: lose half the even-money stake immediately.
- En Prison: stake imprisoned one spin; returned (no profit) if it wins next spin, else forfeited.
- Either rule → even-money house edge **1.35%** (exactly half). Other bets stay 2.70%. Not universal.
- **Not applied in this simulation.** Confirmed via Singapore's Gambling Regulatory Authority
  published rules (Marina Bay Sands & Resorts World Sentosa, v3): zero simply loses every
  non-zero bet outright, English/American-style layout, no racetrack or French call-bet
  terminology (Voisins du Zéro / Tiers du Cylindre / Orphelins / Jeu Zéro are out of scope).
  This matches the Singapore/Malaysia casino convention the simulation targets.

Sources: wizardofodds.com/games/roulette/basics/ · primedope.com/in-depth-guide-to-european-roulette-odds/ · en.wikipedia.org/wiki/En_prison · GRA-published MBS/RWS Roulette Rules v3

---

## 2. BACCARAT (Punto Banco)

**Verified directly against the primary source**: GRA-approved "BACCARAT (MBS) Game Rules Version 8"
(w.e.f. 23 Jan 2020), read in full (not a secondary paraphrase). Every rule below — card values, deal
order, the full third-card table, payouts, tie push, pair definition — is checked word-for-word
against that document, not just Wizard of Odds.

**Decks**: the rule permits **4 to 10 decks** (rule 2.1), not a fixed number — this simulation uses
**8**, both a common real-world choice and the deck count the Monte Carlo-verified edges below assume.

Card values: Ace = 1; 2–9 pip; 10/J/Q/K = 0. **Total = sum mod 10** (can't bust).
**Natural** = 8 or 9 on first two cards (Player or Banker) → both stand.
Probabilities (8-deck): Banker win 0.458597, Player win 0.446247, Tie 0.095156.

**Deal order** (rule 3.12): 1st card → Player, 2nd → Banker, 3rd → Player, 4th → Banker (P,B,P,B),
then the 3rd-card table below governs whether either hand draws a 5th/6th card.

**Pair definition** (rule 1.1.6): "Player Pair"/"Banker Pair" = the hand's first two cards have the
same point value **or are the same face card** (J, Q, or K) — "two face cards that are not identical
(e.g. KQ, KJ, QJ) do not constitute a Pair." K+Q both being worth 0 does **not** make them a pair;
only identical ranks do. The engine compares raw card rank (not point value) so this is correct
without a special case — see `playBaccaratCoup` in `packages/engine/src/games/baccarat.ts`.

**Table layout** (`apps/web/src/components/BaccaratBoard.tsx`): matches rule Appendices "D"/"E" — the
single-playing-position felt (this sim has one bettor per session, same as a lone player at a
1-position table). Order top-to-bottom is a small **P Pair — Tie — B Pair** circle row, then a wide
**Banker** rectangle, then a wide **Player** rectangle beneath it — Banker sits above Player on the
real felt, not side-by-side. An earlier draft of this board used a single left-to-right row and was
corrected after reading Appendix D/E directly.

| Bet | Payout | House edge |
|---|---|---|
| **Player** | 1:1 | **1.24%** |
| **Banker** | 1:1 minus 5% commission (net 0.95:1) | **1.06%** |
| **Tie** | 8:1 | **14.36%** |
| Tie (9:1 variant) | 9:1 | 4.84% |
| Player/Banker Pair | 11:1 | ~10.36% |

Ties **push** on Player/Banker bets. 8:1 tie is near-universal standard.

**Table minimums** (this simulation): Player/Banker **50**; Tie/Player Pair/Banker Pair **10** —
mirrors the Roulette/Sic Bo outside-vs-inside convention (main two-way bets cost more, high-payout
proposition bets cost less). The GRA rule sheet confirms this is a genuine gap, not an oversight —
rule 3.5.1 only requires wagers stay "within the minimum and maximum limits displayed at the table,"
with no number gazetted (floor discretion, same gap as Roulette) — Vegas mini-baccarat commonly runs
a **$25** table minimum as a real-world reference point. Enforced by the adapter: a stake below its
minimum is refused.

**Commission — confirmed directly from rule 4.1's settlement table**: "Banker" pays **0.95 to 1**,
full stop — the 5% commission is baked into the per-hand payout, not tracked via a marker/lammer for
end-of-shoe settlement. The rule text never mentions a commission marker/buck at all; MBS settles
every winning Banker wager immediately, every hand. This matches this engine's behavior exactly.
(Classic Vegas/Macau "big table" high-limit baccarat commonly defers commission via lammer chips
settled at shoe-end instead — not the convention this simulation targets, and not what MBS's own
rule sheet describes.)

**Known simplification**: the shoe is freshly shuffled every coup rather than dealt continuously
through one physical shoe until a cutting card ends the shoe (rule 3.17 — the rule sheet doesn't
specify a burn-card procedure or cut-card depth; that's left to internal casino SOP, not gazetted, so
no specific number is claimed here). Per-hand probabilities are unaffected (each coup is still drawn
from a genuine shuffled 4-to-10-deck composition), but this removes the very slight
composition-dependent edge drift a real continuous shoe exhibits near the cut card — a niche effect
professional shoe-trackers/edge-sorters exploit, not something a casual or LLM bettor would perceive
or exploit in practice.

Sources: gra.gov.sg "BACCARAT (MBS) Game Rules Version 8" (w.e.f. 23 Jan 2020) — read in full, rules
1–6 and Appendices A–E · wizardofodds.com/games/baccarat/basics/ · baccarat.net/guide/table-layout/ ·
wizardofodds.com/games/baccarat/history/ (Bead Plate / Big Road).

**Third-card drawing rules (fixed, no player choice):**
- Step 0 — either hand natural (8/9) → both stand.
- **Player:** total 0–5 draws; 6–7 stands; 8–9 natural.
- **Banker, Case A (Player drew a 3rd card)** — depends on Banker total AND Player's third card:

| Banker total | Draws if Player 3rd card is… | Stands if… |
|---|---|---|
| 0,1,2 | any | (never) |
| 3 | 0,1,2,3,4,5,6,7,9 | 8 |
| 4 | 2,3,4,5,6,7 | 0,1,8,9 |
| 5 | 4,5,6,7 | 0,1,2,3,8,9 |
| 6 | 6,7 | 0,1,2,3,4,5,8,9 |
| 7 | (never) | any |

- **Banker, Case B (Player stood):** Banker draws 0–5, stands 6–7.
- Most-misremembered: Banker 3 stands only vs an 8; Banker 6 draws only on 6–7.

Sources: wizardofodds.com/games/baccarat/basics/ · /appendix/2/

---

## 3. SIC BO (three dice, 216 = 6³ outcomes)

**Verified directly against the primary source**: GRA-approved "SIC BO (MBS) Game Rules Version 7"
(w.e.f. 19 Sep 2025), read in full (rule text extracted and cross-checked against the rendered
Appendix A/B page images, not a secondary paraphrase). Every payout below is rule 4.1's settlement
table, not the generic international/Wizard-of-Odds set most secondary sources quote — several
figures differ, always in the **player's** favor (GRA pays more than the generic table on 8 of the
13 bet families).

**Bet definitions** (rule 3.5): Small (3.5.1) and Big (3.5.2) win on totals 4–10 / 11–17
respectively and **lose on any total outside that range or on any triple** — the triple exclusion
applies to Small/Big/Odd/Even only. Odd (3.5.3) and Even (3.5.4) are the same shape, by parity,
also losing on any triple. Three Dice Totals (3.5.8) has **no triple exclusion** — a wager on Total
9 wins on 3-3-3 exactly like any other combination summing to 9 (confirmed by rule 3.5.8.1's
wording, which never mentions Any Triple, unlike 3.5.1–3.5.4). Specific Double (3.5.6) wins on 2 or
3 of a face; Specific Triple (3.5.5) needs all 3; Any Triple (3.5.7) is any three-of-a-kind; Two
Dice Combinations (3.5.9) needs both named faces present anywhere among the three dice; Single Dice
Wager (3.5.12) needs the named face on 1 or more dice, paid by match count.

Small/Big/Odd/Even: **loses on any triple**, prob 48.61%, payout 1:1, house edge **2.78%** (rule
4.1.1).

Three-dice totals (rule 4.1.2 — no triple exclusion):

| Total | Ways/216 | Payout (GRA) | House edge |
|---|---|---|---|
| 4 / 17 | 3 | **62:1** | 12.50% |
| 5 / 16 | 6 | **31:1** | 11.11% |
| 6 / 15 | 10 | **18:1** | 12.04% |
| 7 / 14 | 15 | 12:1 | 9.72% (best total) |
| 8 / 13 | 21 | 8:1 | 12.50% |
| 9 / 12 | 25 | **7:1** | **7.41%** (2nd-best total) |
| 10 / 11 | 27 | 6:1 | 12.50% |

(Totals 3 and 18 are the specific-triple bet, not "total" bets — rule 3.5.8's range is 4–17.)

Singles/doubles/triples/combos (rule 4.1.1 named sections; 4.1.6 single dice; 4.1.3 two-dice combo):

| Bet | Detail | Prob | Payout (GRA) | House edge |
|---|---|---|---|---|
| Single number (1 die) | shows on 1 die | 34.72% | 1:1 | combined |
| Single number (2 dice) | | 6.94% | 2:1 | combined |
| Single number (3 dice) | | 0.46% | **12:1** | overall **3.70%** |
| Two-dice combo (domino) | two specific faces both appear | 13.89% | **6:1** | **2.78%** |
| Specific double | chosen pair (≥2 of a face) | 7.41% | **11:1** | **11.11%** |
| Any triple | any three-of-a-kind | 2.78% | **31:1** | **11.11%** |
| Specific triple | chosen three-of-a-kind | 0.46% | 180:1 | **16.20%** |

**Notable finding**: the Two-Dice Combo at 6:1 computes to exactly −2.78% (−1/36), tying
Small/Big/Odd/Even as the best bet on the table — under the generic 5:1 table it was one of the
*worst* (16.67%). This flips the naive "even-money bets are always best" heuristic a rule-bot or
LLM might otherwise assume, and is why the adapter's `houseEdgePct` observation enumerates every
family exactly rather than summarizing.

**Table minimums**: same generic-limits pattern as Roulette/Baccarat — rule 5.10–5.12 only say
wagers stay "within the minimum and maximum" displayed at the table, no figures gazetted. This
simulation uses the same 50 (even-money outside: Small/Big/Odd/Even) / 10 (everything else inside)
convention as Roulette/Baccarat. Enforced by the adapter.

**Known simplification**: the real MBS felt (Appendix A/B) also offers three exotic side-bet
families not implemented here — **Three Single Dice Combinations** (rule 3.5.10/4.1.4, pick one
exact 3-distinct-face triple, 30:1), **Double Numbers With Single Dice Combinations** (rule
3.5.11/4.1.5, pick one exact double+single-face combination, 50:1 — the printed felt omits exactly
2 of the 30 possible double+single pairs, (1,2) and (6,5)), and **Three Dice From Four Possible
Combinations** (rule 3.5.13/4.1.7, four fixed 4-number windows — 1234/2345/2356/3456 — win if the
three dice are a 3-subset of the chosen window, 7:1). These are rare novelty bets real players
mostly ignore; out of scope for this engine by deliberate choice, not oversight.

Sources: gra.gov.sg "SIC BO (MBS) Game Rules Version 7" (w.e.f. 19 Sep 2025) — read in full, rules
1–6, rule 4.1 settlement tables, and Appendix A/B · wizardofodds.com/games/sic-bo/ · /appendix/1/.

---

## 4. SLOT MACHINE (example configuration — no single standard exists)

**RTP** = long-run fraction paid back; **house edge = 100% − RTP**. Land-based ~88–94%, online ~94–98%.
**Virtual reels / RNG:** RNG picks outcome; symbols weighted by number of stops mapped to them (weighting baked into strip).
Core: **RTP = Σ P(combo) × payout multiplier**; for independent reels P(combo) = product of per-reel symbol probs.

**Worked deterministic example — 3-reel, single payline, 1-coin bet.**
Reel strip (32 stops, identical all 3 reels): 7=1, BAR=3, BELL=6, CHERRY=4, BLANK=18. Outcomes = 32³ = 32,768.

| Combination | Payout ×bet | Count/32768 |
|---|---|---|
| 7-7-7 | 2000 | 1 |
| BAR×3 | 200 | 27 |
| BELL×3 | 50 | 216 |
| CHERRY×3 | 25 | 64 |
| CHERRY on reels 1&2 only | 8 | 448 |
| CHERRY on reel 1 only | 2 | 3584 |

Total winning = 4340; Σ count×payout = 30552. **RTP = 30552/32768 = 93.24%**, house edge = 6.76%.
Hit frequency = 4340/32768 = **13.24%**. (7-7-7 alone contributes 6.10% of RTP → moderate/high volatility.)

Deterministic impl: seed RNG → per reel `i = rng.randrange(32)`, symbol = `strip[i]` → evaluate ordered paytable
(jackpot-first so exclusive cherry cases resolve) → return first match ×bet. Tune RTP via strip weights/payouts;
integer payouts converge to a nearby value, not a round number.

Sources: wizardofodds.com/games/slots/ · easy.vegas/games/slots/how-they-work · /returns

---

### Cross-game notes
- All house edges here are exact/derivable from combinatorics except Slots (whatever the config computes to).
- Roulette, Baccarat, and Sic Bo payouts are verified directly against gazetted GRA (Singapore)
  rule sheets, read in full. Slots payouts are casino-dependent — ship a defensible example
  configuration but keep it **configurable**.

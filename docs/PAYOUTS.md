# Casino Games — Verified Rules, Payouts & House Edge (Source of Truth)

> Primary source: **Wizard of Odds** (wizardofodds.com), each corroborated by a second reputable source.
> Payout notation is **X:1 (to-one, net profit; stake returned on top)**. If an engine pays "for one"
> (stake included), subtract 1. Incorrect payouts silently invalidate any experiment — treat this file
> as authoritative and cross-check the code against it.

---

## 1. ROULETTE

**Verified directly against the primary sources**: GRA-approved "Roulette (MBS) Game Rules Version 3"
(w.e.f. 14 Aug 2019) and "RWS ROULETTE Game Rules" (w.e.f. 3 Feb 2023, superseding an earlier v3 from
2019) — both read in full, including the appendix table-layout images (rendered from the PDF), not
just the text.

**Two real tables, two wheels**: MBS's rule text (4.2: "when the outcome is 0, wagers placed on a
straight up 0 or on any combination of 0 and the numbers 1, 2 and/or 3 shall win") describes a
genuine **single-zero (European, 37 pockets)** wheel with no `00` anywhere. RWS's appendix images (all
four of its pay-table layouts, A/B through J/K) show `0` **and** `00` as two separate physical pockets
every time — RWS's roulette is **always double-zero (American, 38 pockets)**; it does not offer a
plain single-zero table. This simulation models both: `variant: 'european'` = MBS-style, `'american'`
= RWS-style (picked via the table selector in the UI, `RouletteConfig.variant`).

| Bet | Numbers | Payout | Which table |
|---|---|---|---|
| Straight-up | 1 | 35:1 | both |
| Split | 2 | 17:1 | both |
| Street | 3 | 11:1 | both |
| Corner / Square | 4 | 8:1 | both |
| Six-line / Double street | 6 | 5:1 | both |
| Column | 12 | 2:1 | both |
| Dozen | 12 | 2:1 | both |
| Red/Black | 18 | 1:1 | both |
| Odd/Even | 18 | 1:1 | both |
| High/Low (1–18 / 19–36) | 18 | 1:1 | both |
| **Top Line** ("five": 0,00,1,2,3) | 5 | **5:1** | RWS/American only |
| **0/00 Combo** (`zeroCombo`) | 2 | **11:1** | RWS/American only |
| **3 Numbers Series** (`series3`) | 3 | **11:1** | RWS/American only |
| **6 Numbers Series** (`series6`) | 6 | **5:1** | RWS/American only |

House edge: **European (MBS) 2.70%** (1/37), **American (RWS) 5.26%** (2/38, applies to every
standard bet **and** the Series bets, which are just a repackaged street/sixline). The Top Line and
0/00 Combo are real GRA-approved bets with a much worse edge — **21.05%** and **36.84%**
respectively — genuine "sucker bets" a human player might be tempted by despite the odds; this is
intentional GRA-verified realism, not a simulation quirk.

**Zero-adjacent street geometry — GRA Appendix C/F/I/L, quoted verbatim**: "A Bet on all three
numbers in a row... Also can be placed at the corner on 0, 1 and 2 or 00, 2 and 3, or 0, 00 and 2 or
0, 00 and 3 where the 3 numbers touch." The only zero-street on a **single-zero** wheel is `{0,1,2}` —
`{0,2,3}` is **not** a real street; it requires `00` to exist (as `{00,2,3}`). An earlier version of
this engine incorrectly allowed `{0,2,3}` as a European street; fixed.

**"3/6 Numbers Series" bets (RWS pay tables 3/4)** are wheel-sector bets, not French call bets
(Voisins/Tiers/Orphelins — this Singapore table has no racetrack and no French terminology at all).
Verified by construction: partitioning the standard European wheel sequence
(0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26),
minus the zero, into 12 consecutive groups of 3 reproduces the exact 12 groups printed in the RWS
Appendix G image, set-for-set (the printed felt lists them in the opposite order). `series6` groups
are just adjacent `series3` pairs. The GRA rules never publish `00`-inclusive-wheel groupings
separately, so this simulation applies the same European-sequence-derived groups on both variants —
a documented, consistent extrapolation, not a literal second citation.

**"0/00 Combo" is a distinct named bet, not a generic split**: RWS pay tables 2/4 list a dedicated
felt box covering only `{0, 00}` at **11:1** — far worse than the fair 17:1 a literal split bet on the
same two numbers would pay if placed on the line between them (also legal, via `split`). Both are
modeled; a player/bot can choose the fair split or the flashier, worse-paying dedicated box.

**Table minimums** (this simulation, mirrors the Sic Bo convention): outside even-money bets
(Red/Black/Odd/Even/High/Low) **50**; every other bet (straight/split/street/corner/sixline/column/
dozen/five/zeroCombo/series3/series6) **10**. Neither GRA rule sheet gazettes a specific dollar
figure (both only require limits "displayed at the table") — Marina Bay Sands publicly advertises a
**$5** roulette table minimum as a real-world reference point. Enforced by the adapter — a stake
below its bet's minimum is refused, as is any bet whose numbers/selector don't form a real cell/
line/corner/series-group on the felt.

**La Partage / En Prison** (single-zero French tables, even-money bets only, when ball hits 0):
- La Partage: lose half the even-money stake immediately.
- En Prison: stake imprisoned one spin; returned (no profit) if it wins next spin, else forfeited.
- Either rule → even-money house edge **1.35%** (exactly half). Other bets stay 2.70%. Not universal.
- **Not applied in this simulation** — confirmed by both GRA rule sheets directly: zero simply loses
  every non-zero bet outright, English/American-style layout, no racetrack or French call-bet
  terminology (Voisins du Zéro / Tiers du Cylindre / Orphelins / Jeu Zéro are out of scope). This
  matches the Singapore casino convention the simulation targets.

Sources: gra.gov.sg "Roulette (MBS) Game Rules Version 3" (w.e.f. 14 Aug 2019, read in full) ·
gra.gov.sg "RWS ROULETTE Game Rules" (w.e.f. 3 Feb 2023, read in full incl. Appendices A–L images) ·
wizardofodds.com/games/roulette/basics/ · en.wikipedia.org/wiki/En_prison

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
(w.e.f. 19 Sep 2025), read in full — rule text cross-checked against the rendered Appendix A/B page
images, not a secondary paraphrase. Every payout below is rule 4.1's settlement table, not the
generic international/Wizard-of-Odds set most secondary sources quote — several figures differ,
always in the **player's** favor (GRA pays more than the generic table on 8 of the 13 bet families).
An earlier pass on this doc cited "Version 6" (w.e.f. 11 Feb 2020); v7 carries the same payouts and
bet families, just a newer gazette date — nothing below changed as a result of the version bump.

**Bet definitions** (rule 3.5): Small (3.5.1) and Big (3.5.2) win on totals 4–10 / 11–17
respectively and **lose on any total outside that range or on any triple** — the triple exclusion
applies to Small/Big/Odd/Even only. Odd (3.5.3) and Even (3.5.4) are the same shape, by parity, also
losing on any triple. Three Dice Totals (3.5.8) has **no triple exclusion** — a wager on Total 9
wins on 3-3-3 exactly like any other combination summing to 9 (confirmed by rule 3.5.8.1's wording,
which never mentions Any Triple, unlike 3.5.1–3.5.4). Specific Double (3.5.6) wins on 2 or 3 of a
face; Specific Triple (3.5.5) needs all 3; Any Triple (3.5.7) is any three-of-a-kind; Two Dice
Combinations (3.5.9) needs both named faces present anywhere among the three dice; Single Dice Wager
(3.5.12) needs the named face on 1 or more dice, paid by match count.

Small/Big/Odd/Even: **loses on any triple**, prob 48.61%, payout 1:1, house edge **2.78%** (rule
4.1.1) — the best bet on the table, tied with Two-Dice Combo (see below).

**Three-dice totals (rule 4.1.2, no triple exclusion)** — every payout differs from the generic
60/30/17/12/8/6/6 table:

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

**Named/single-face bets (rule 4.1.1 named sections; 4.1.6 single dice; 4.1.3 two-dice combo)**:

| Bet | Detail | Prob | Payout (GRA) | House edge |
|---|---|---|---|---|
| Single, 1 die shows | | 34.72% | 1:1 | combined |
| Single, 2 dice show | | 6.94% | 2:1 | combined |
| Single, 3 dice show | | 0.46% | **12:1** (not 3:1) | overall **3.70%** |
| Two-dice combo (domino) | two specific faces both appear | 13.89% | **6:1** | **2.78%** |
| Specific double | chosen face appears ≥2 times | 7.41% | **11:1** | **11.11%** |
| Any triple | any three-of-a-kind | 2.78% | **31:1** | **11.11%** |
| Specific triple | chosen three-of-a-kind | 0.46% | 180:1 | **16.20%** |

The single-number 3-match payout (**12:1**, rule 4.1.6) is the single biggest fidelity gap the old
table had — most international Sic Bo tables (and the AU variant this doc previously cited) pay 3:1
for a triple match on a single-number bet; Singapore's GRA-approved MBS table pays **12:1**, making
Single one of the best bets on the table (3.70% edge) rather than one of the worst (7.87%).

**Notable finding**: the Two-Dice Combo at 6:1 computes to exactly −2.78% (−1/36), tying
Small/Big/Odd/Even as the best bet on the table — under the generic 5:1 table it was one of the
*worst* (16.67%). This flips the naive "even-money bets are always best" heuristic a rule-bot or LLM
might otherwise assume, and is why the adapter's `houseEdgePct` observation enumerates every family
exactly rather than summarizing.

**Three exotic side-bet families**, absent from the old generic table, from the real MBS felt
(Appendix A/B) — each a single **exact-match** wager, not a grouped OR-bet (verified by house-edge
math: treating a printed row-grouping as "any cell in the group wins" back-solves to an impossible
+183% player edge, confirming each code is its own single-outcome target):

| Bet | Rule | Detail | Payout | House edge |
|---|---|---|---|---|
| Three Single Dice Combo (`threeSingleCombo`) | 3.5.10/4.1.4 | one exact 3-distinct-face triple (20 cells total, felt-grouped into 4 rows of 5 purely cosmetically) | **30:1** | 13.89% |
| Double + Single Dice Combo (`doubleAny`) | 3.5.11/4.1.5 | one exact double-**D** + single-**P** combination | **50:1** | **29.17%** (worst bet on the table) |
| Three Dice From Four (`threeFromFour`) | 3.5.13/4.1.7 | one of 4 fixed 4-number windows (1234/2345/2356/3456) — a genuine group-OR bet (unlike the two above): wins if the three dice are any 3-subset of that window | **7:1** | 11.11% |

`doubleAny`'s 30 possible (double, partner) pairs are **not all offered**: the printed felt omits
exactly two — double-1-with-partner-2 and double-6-with-partner-5 — leaving 28 real cells
(`SICBO_DOUBLE_ANY_PAIRS` in `packages/engine/src/games/sicbo.ts`). This asymmetry is transcribed
directly from the appendix image, not a bug. These are rare novelty bets real players mostly ignore,
but a faithful house edge requires exposing them accurately to any decider tempted by the flashy
50:1 payout.

**Table layout** (`apps/web/src/components/SicBoBoard.tsx`): matches Appendix A/B — Double+Single and
Three-Single-Dice occupy a dedicated left column (the old board omitted both entirely); the top band
pairs **EVEN with BIG** on the left and **ODD with SMALL** on the right (the old board had this
backwards: Small-over-Odd and Big-over-Even), flanking the doubles/specific-triples/Any-Triple fan;
then totals, the 15 two-dice combos, the new Three-From-Four row, then the 6 single-number cells.

**Table minimums**: same generic-limits pattern as Roulette/Baccarat — rules 5.10–5.12 only say
wagers stay "within the minimum and maximum" displayed at the table, no figures gazetted. This
simulation uses the same 50 (even-money outside: Small/Big/Odd/Even) / 10 (everything else inside,
including the 3 exotic families) convention as Roulette/Baccarat. Enforced by the adapter.

Sources: gra.gov.sg "SIC BO (MBS) Game Rules Version 7" (w.e.f. 19 Sep 2025, read in full incl.
Appendix A/B images) · wizardofodds.com/games/sic-bo/ · /appendix/1/ (generic/international
comparison table only, no longer the payout source of truth for this simulation).

---

## 4. SLOT MACHINE (243-ways video slot — example configuration, no single standard exists)

**RTP** = long-run fraction paid back; **house edge = 100% − RTP**. Land-based ~88–94%, online ~94–98%.
Slot paytables/reel strips are manufacturer-proprietary — no public "official" table exists (unlike Roulette/
Baccarat/Sic Bo). What Singapore's **Gambling Regulatory Authority (GRA) "Technical Standards for Electronic
Gaming Machines" v1.0** does mandate is a legal floor: **minimum theoretical RTP ≥ 90.0%** (§3.3.2), holding at
every bet level (§3.3.3(a)); a gamble/double-up feature must pay exactly 100% RTP (§3.3.5); the RNG decides the
outcome at spin-press with every combination reachable (§3.4.1–3.4.2); and — the detail that most separates a
faithful sim from a naive one — **weighted virtual reels are the norm** (§3.4.6): the displayed 3-row window on
each reel is 3 *consecutive* stops on a longer weighted strip, not 3 independently-sampled symbols.

**Machine shape**: 5 reels × 3 rows, **243 ways-to-win** (3⁵ — Aristocrat/WMS "Reel Power"-style: every way is
always active, matching cells on *consecutive* reels starting at reel 1, any row, win regardless of a fixed
line). This has no line-selection decision, which maps cleanly onto this sim's one-stake-per-round architecture
— real 243-ways cabinets work the same way, it isn't a simplification. 9 symbols: `WILD` (subs every paying
symbol, not scatter), `SCATTER` (pays anywhere, any row/reel; triggers free spins), 3 high-pay (`DRAGON`/
`TIGER`/`LOTUS`), 4 low-pay (`ACE`/`KING`/`QUEEN`/`TEN`).

**Reel strips** (32 stops each; composition varies per reel — reel 3 is the "loosest," an extra wild, one fewer
king — real cabinets vary reels the same way):

| Symbol | Reel 1 | Reel 2 | Reel 3 | Reel 4 | Reel 5 |
|---|---|---|---|---|---|
| WILD | 1 | 2 | 2 | 2 | 1 |
| SCATTER | 1 | 1 | 1 | 1 | 1 |
| DRAGON | 1 | 1 | 1 | 1 | 1 |
| TIGER | 1 | 1 | 1 | 1 | 1 |
| LOTUS | 2 | 2 | 2 | 2 | 2 |
| ACE | 3 | 3 | 3 | 3 | 3 |
| KING | 5 | 5 | 4 | 5 | 5 |
| QUEEN | 8 | 7 | 8 | 7 | 8 |
| TEN | 10 | 10 | 10 | 10 | 10 |
| **Total** | **32** | **32** | **32** | **32** | **32** |

**Paytable** (3-of/4-of/5-of-a-kind, "for-one" multiplier of TOTAL bet, already ways-normalized — a run's payout
is `paytable[symbol][count-3] × ways / 243`):

| Symbol | ×3 | ×4 | ×5 |
|---|---|---|---|
| DRAGON | 75 | 210 | 750 |
| TIGER | 42 | 115 | 370 |
| LOTUS | 26 | 74 | 210 |
| ACE | 16 | 42 | 148 |
| KING | 16 | 37 | 116 |
| QUEEN | 7 | 26 | 84 |
| TEN | 7 | 21 | 74 |

**Scatter pay + free spins**: 3 scatters → 2× total bet + 8 free spins; 4 → 5× + 15 free spins; 5 → 20× + 20 free
spins. Free spins execute automatically inside the engine per triggering round (no new bet decision, same
precedent as Blackjack's post-bet action loop) — **v1 has no retriggers**: a bonus spin's own scatter hits still
pay the scatter amount, but never extend the bonus round (keeps the RTP formula below exact/closed-form; a clean
v2 seam).

**RTP — exact by enumeration**, not estimated. Each reel's 32 stops collapse to the distinct 3-symbol *window
signatures* they produce (grouping by sorted multiset, since row order never affects scoring) — roughly 15-19
signatures per reel — turning the full 32⁵ = 33,554,432-combination space into ~2.2M weighted signature-tuples,
enumerated exactly (implementation: `slotRtpBreakdown()` in `packages/engine/src/games/slot.ts`, cross-checked
against a 500,000-round Monte Carlo simulation of the actual main+bonus-spin loop):

- Ways-win EV per spin (`waysRtp`) = **87.088%**
- Scatter-pay EV per spin (`scatterRtp`) = **1.543%**
- Base-game EV per spin (`baseRtp` = waysRtp + scatterRtp) = **88.631%**
- Trigger probability: 3 scatters ≈ 0.6767% (1-in-148), 4 ≈ 0.0350% (1-in-2857), 5 ≈ 0.00072% (1-in-138,089)
- Trigger frequency (3+) ≈ **0.712%** (1-in-140 spins) — realistic for a real cabinet (typical range 1-in-100 to
  1-in-300)
- Expected free spins per spin ≈ **0.05953**
- **Closed form (exact, since free spins reuse the base config and v1 has no retriggers):
  `totalRTP = baseRtp × (1 + expectedFreeSpinsPerSpin) = 0.88631 × 1.05953 = 93.907%`**, house edge = **6.093%**
- Independent Monte Carlo cross-check (500,000 full rounds, main+bonus loop): within 2% of the closed form,
  consistent given the fat right tail from rare 5-of-a-kind/5-scatter hits.
- Hit frequency (any nonzero payout on a spin) ≈ **20.2%** — in line with real video slots (typically 20–35%).

**93.907% RTP is comfortably above the SG GRA's 90.0% legal floor and inside the realistic 90–97% band** for a
real cabinet — this is a defensible worked example, verified by code, not a rounded guess.

**Betting controls**: real cabinets separate *denomination* (coin value) from *bet level* (credits per spin) —
the player presses a denomination chip and a bet-level stepper, or slams BET MAX, rather than typing a raw
stake. This sim mirrors that: `denominations = [1, 2, 5, 10, 25, 50]` (sim-points, analogous to a real cabinet's
cent-to-dollar range — SG regulation sets no fixed denomination, only the RTP floor), `betLevel = 1..10`, so
`SLOT_MIN_BET = 1` and `SLOT_MAX_BET = 500`. Every decider — rule bot, naive "casual human" bot, and LLM — chooses
`{ denomination, betLevel, betMax }`, not a bare number, so its reasoning trace and the UI replay both speak in
terms of the machine's actual physical controls.

Sources: gra.gov.sg "Technical Standards for Electronic Gaming Machines (Singapore)" v1.0 (read in full, §§2-3) ·
Casino Control (Gaming Equipment) Regulations 2009, Reg. 12 · wizardofodds.com/games/slots/ ·
easy.vegas/games/slots/how-they-work · hardrock.bet/casino/how-to-play-slots/reels-and-paylines/ (243-ways
mechanics) · betus.com.pa "what-are-243-ways-slots" · bgaming.com/articles/rtp-in-slot-games-how-return-to-player-works

---

### Cross-game notes
- All house edges here are exact/derivable from combinatorics, including Slots (`slotRtpBreakdown()`
  enumerates exactly; Monte Carlo is an independent cross-check only, never the tuning method).
- Roulette, Baccarat, and Sic Bo payouts are verified directly against gazetted GRA (Singapore)
  rule sheets, read in full. Slot paytables/reel strips are casino-dependent — ship a defensible
  example configuration but keep it **configurable**.

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

**La Partage / En Prison** (single-zero French tables, even-money bets only, when ball hits 0):
- La Partage: lose half the even-money stake immediately.
- En Prison: stake imprisoned one spin; returned (no profit) if it wins next spin, else forfeited.
- Either rule → even-money house edge **1.35%** (exactly half). Other bets stay 2.70%. Not universal.

Sources: wizardofodds.com/games/roulette/basics/ · primedope.com/in-depth-guide-to-european-roulette-odds/ · en.wikipedia.org/wiki/En_prison

---

## 2. BACCARAT (Punto Banco, 8-deck shoe)

Card values: Ace = 1; 2–9 pip; 10/J/Q/K = 0. **Total = sum mod 10** (can't bust).
**Natural** = 8 or 9 on first two cards (Player or Banker) → both stand.
Probabilities: Banker win 0.458597, Player win 0.446247, Tie 0.095156.

| Bet | Payout | House edge |
|---|---|---|
| **Player** | 1:1 | **1.24%** |
| **Banker** | 1:1 minus 5% commission (net 0.95:1) | **1.06%** |
| **Tie** | 8:1 | **14.36%** |
| Tie (9:1 variant) | 9:1 | 4.84% |
| Player/Banker Pair | 11:1 | ~10.36% |

Ties **push** on Player/Banker bets. 8:1 tie is near-universal standard.

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

**Payouts vary by casino** — expose as configurable. Below = common Wizard of Odds standard set; variants noted.

Small/Big: total 4–10 / 11–17, **loses on any triple**, prob 48.61%, payout 1:1, house edge **2.78%** (best bets).

Three-dice totals:

| Total | Ways/216 | Payout (std) | House edge | Variant |
|---|---|---|---|---|
| 4 / 17 | 3 | 60:1 | 15.28% | — |
| 5 / 16 | 6 | 30:1 | 13.89% | — |
| 6 / 15 | 10 | 17:1 | 16.67% | 18:1 → 12.04% |
| 7 / 14 | 15 | 12:1 | 9.72% | — (best total) |
| 8 / 13 | 21 | 8:1 | 12.50% | — |
| 9 / 12 | 25 | 6:1 | 18.98% | — |
| 10 / 11 | 27 | 6:1 | 12.50% | — |

(Totals 3 and 18 are the specific-triple bet, not "total" bets.)

Singles/doubles/triples/combos:

| Bet | Detail | Prob | Payout (std) | House edge | Variant |
|---|---|---|---|---|---|
| Single number (1 die) | shows on 1 die | 34.72% | 1:1 | combined | |
| Single number (2 dice) | | 6.94% | 2:1 | combined | |
| Single number (3 dice) | | 0.46% | 3:1 | overall **7.87%** | AU 12:1 → 3.70% |
| Two-dice combo (domino) | two specific faces both appear | 13.89% | 5:1 | **16.67%** | — |
| Specific double | chosen pair (≥2 of a face) | 7.41% | 10:1 | **18.52%** | 8:1 → 33.33% |
| Any triple | any three-of-a-kind | 2.78% | 30:1 | **13.89%** | 24:1 → 30.56% |
| Specific triple | chosen three-of-a-kind | 0.46% | 180:1 | **16.20%** | 150:1 → 30.09% |

Sources: wizardofodds.com/games/sic-bo/ · /appendix/1/ · playsmart.ca/novelty-games/sic-bo/odds/

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
- Sic Bo & Slots payouts are casino-dependent — ship a defensible standard table but keep it **configurable**.

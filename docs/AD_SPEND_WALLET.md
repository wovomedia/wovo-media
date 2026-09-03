# WOVO Ad Spend Wallet — design and gate

**Status: NOT STARTED. Design only. Must not ship as specified without the
review in section 10.**

This document exists because the Ad Spend Wallet is the one part of the WOVO
product plan that is not really a software problem. Everything else on the
roadmap is "build it and test it". This one is "decide who is allowed to hold
the money, and under what licence" — and that decision comes before the schema.

---

## 1. What is being proposed

A customer deposits money with WOVO, earmarks it for advertising, and WOVO
spends it on their behalf on Meta, Google, TikTok, YouTube or LinkedIn.

```
customer card ──► WOVO ──► holds balance ──► platform ad account ──► media spend
```

That middle step — **WOVO holds customer money intended for a third party** — is
what makes this different from every other WOVO charge. A subscription payment
is WOVO's revenue the moment it settles. A wallet deposit is not. It is the
customer's money, sitting with WOVO, owed either to a platform or back to the
customer.

## 2. The three pots, which must never mix

| Pot | Whose money | Can it become WOVO revenue? |
|---|---|---|
| **WOVO Credits** | WOVO's, on receipt | Yes — this is revenue |
| **WOVO management fee** | WOVO's, on receipt | Yes — this is revenue |
| **Customer media funds** | The customer's, held by WOVO | **No** — never, until spent on their behalf |

Hard rules, restated as invariants a test can check:

- Media funds can never be converted into WOVO Credits.
- Media funds can never pay for image, video, music or Computer work.
- Media funds can never pay a subscription.
- One workspace's funds can never reach another workspace's campaign.
- Media funds are never recognised as revenue. Only the management fee is.
- The balance can never go negative.

## 3. Balance states

A single number is not enough, because money is committed before it is spent and
platforms report spend late.

```
TOTAL       = everything deposited and not refunded
UNALLOCATED = deposited, no platform chosen yet — unspendable by design
ALLOCATED   = assigned to a platform, not yet committed to a campaign
RESERVED    = committed to an approved campaign, not yet reported as spent
PENDING     = platform says spent, not yet final
SPENT       = final
REFUNDABLE  = unallocated + allocated, minus anything under dispute
```

`AVAILABLE = ALLOCATED − RESERVED`. That is the only number a campaign may draw
against.

## 4. Ledger

Append-only. No row is ever updated in place; corrections are new rows. Every row
carries `workspace_id`, an actor, a timestamp and a reason.

Transaction types: `deposit`, `allocation`, `deallocation`, `campaign_reservation`,
`reservation_release`, `platform_spend`, `platform_refund`, `wallet_refund`,
`management_fee`, `adjustment`, `chargeback`, `failed_payment`.

Balances are derived by folding the ledger, never stored as a mutable column. If
a cached balance exists it is a read model that can be rebuilt from the ledger and
reconciled on a schedule.

## 5. Reserve → spend → release

```
approved campaign budget $100
  reserve            AVAILABLE −100   RESERVED +100
  platform reports    $82.41 spent    RESERVED −82.41  SPENT +82.41
  campaign ends       RESERVED −17.59 AVAILABLE +17.59
```

Never mark a whole budget spent at launch. Never release a reservation while the
platform still reports pending spend. Both mistakes are how a customer ends up
able to withdraw money that has already been committed.

## 6. Funding

Stripe is authoritative and the webhook is the only thing that credits a wallet.
A wallet is **never** credited because a success page rendered. Every deposit
carries an idempotency key so a replayed webhook cannot double-credit.

Checkout must show the split, never a single blended number:

```
Ad spend funds        $500.00
WOVO management fee    $25.00
Total                 $525.00
```

## 7. Chargebacks

A disputed deposit freezes the corresponding unspent funds immediately, blocks
new reservations against them, and flags the workspace internally. Money already
spent on the platform cannot be clawed back by WOVO and must never be presented
to the customer as refundable — the honest answer is that the media ran.

## 8. Refunds

Only `REFUNDABLE` funds can be returned, subject to settlement timing, processor
rules and pending platform spend. The interface must never imply that spent media
money is recoverable.

## 9. The lower-risk alternative — build this one first

**Direct platform billing.** The customer's own payment method is attached to
their own ad account. Meta, Google or TikTok bills them directly. WOVO never
holds media funds and charges only the management fee.

This delivers most of what the customer actually wants — Adam plans the campaign,
builds the creative, launches it, watches the numbers, pauses it — with none of
the custody exposure. It should be built and shipped before any wallet work
begins, and it should remain available permanently as an option even after a
wallet exists.

## 10. The gate

Before any wallet code reaches production, the following must be answered by
people qualified to answer them — not by an engineer and not by an AI:

1. Does holding customer funds earmarked for third-party media make WOVO a money
   transmitter in the states it operates in, and does it need a licence?
2. Must these funds sit in a segregated or custodial account rather than WOVO's
   operating account?
3. How are deposits treated for revenue recognition and for tax — clearly not as
   revenue, but as what?
4. What do the customer terms have to say about unused funds, dormancy, refund
   windows and what happens if a platform rejects a campaign?
5. What does escheatment (unclaimed property) law require for balances a customer
   abandons?
6. What is the reconciliation process, how often does it run, and who signs it?
7. What is the insolvency answer — if WOVO stops trading, whose money is it and
   how do they get it back?

Until every one of these has a documented answer, the wallet is design-only. This
is not caution for its own sake: shipping it early risks the company, not the
sprint.

## 11. What to build now instead

1. Direct platform billing (section 9).
2. Campaign budgets, caps and approval checkpoints — the safety logic is
   identical, minus custody.
3. Real read-only ad performance from the platform APIs.
4. Leads flowing from campaigns into WOVO.

All four are useful on their own, and all four are prerequisites for a wallet
anyway. None of them requires WOVO to hold a cent of anyone else's money.

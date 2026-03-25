# Dreamers Coin (DR) — Tokenomics Document

> Version 1.0 | March 2026
> Dreamer Dash — Telegram Mini App

---

## 1. Overview

Dreamers Coin (DR) is the native utility token of the Dreamer Dash ecosystem. It powers a circular community rewards economy where members earn DR through participation and spend it on real-world rewards.

**Total Supply: 21,000,000 DR (fixed, hard-capped)**

No additional DR can ever be created beyond this limit. The supply is enforced at the database level and cannot be overridden by any admin.

---

## 2. Supply Allocation

| Allocation | Amount | % | Purpose |
|---|---|---|---|
| Community Treasury | 15,000,000 DR | 71% | Distributed through activities, missions, check-ins, referrals |
| Hackathon Prize Pool | 2,000,000 DR | 10% | Reserved for hackathon prizes and competition rewards |
| Referral Program | 1,000,000 DR | 5% | Mutual bonuses for referrer and referred users |
| Founding Team | 3,000,000 DR | 14% | Vested over 24 months (125,000 DR/month unlock) |

### Supply States

At any point in time, every DR coin exists in one of two states:

- **Treasury (Unissued):** Coins waiting to be distributed. These are not in circulation.
- **Circulating:** Coins held in user wallets. This is the active supply.
```
Total Supply = Treasury + Circulating = 21,000,000 (always)
```

No coins are ever burned or destroyed. Every DR coin lives forever.

---

## 3. Coin Flow — The Circular Economy

DR operates as a circular economy. Coins flow from the treasury to users, between users, and back to the treasury. No coins are ever destroyed.

```
     ┌─────────────────────────────────────────────┐
     │            TREASURY (Unissued Pool)          │
     │         Starting: 15,000,000 DR              │
     └──────┬──────────────────────────▲────────────┘
            │                          │
            │ EARN                     │ RECYCLE
            │ (activities, missions,   │ (100% of redemptions,
            │  check-ins, referrals)   │  hackathon fees,
            │                          │  transfer fees)
            ▼                          │
     ┌──────────────────────────────────────────────┐
     │           USER WALLETS (Circulating)          │
     │                                               │
     │   User A ◄──── Transfer (2% fee) ────► User B │
     └──────────────────────────────────────────────┘
```

### Flow Summary

| Action | From | To | Notes |
|---|---|---|---|
| Activity reward | Treasury | User | Admin creates activity with DR reward |
| Daily check-in | Treasury | User | +25 DR base, streak bonuses |
| Mission reward | Treasury | User | Earned by completing missions |
| Referral bonus | Treasury | Both users | +100 DR each (referrer + referred) |
| Achievement reward | Treasury | User | Auto-granted when conditions met |
| User transfer | User A | User B | 2% fee goes to Treasury |
| Hackathon entry | User | Treasury | Entry fee recycled |
| Hackathon prize | Treasury | Winner | From Hackathon Prize Pool |
| Redemption | User | Treasury (100%) | Full recycling back to treasury |
| Admin adjustment | Treasury | User | Rate-limited, audited |

---

## 4. Emission Schedule (Halving)

To create scarcity and reward early participation, the maximum daily emission rate halves periodically.

| Period | Max Daily Emission | Annual Max | Notes |
|---|---|---|---|
| Year 1 (Months 1–12) | 5,000 DR/day | 1,825,000 DR | Early adopter incentive |
| Year 2 (Months 13–24) | 2,500 DR/day | 912,500 DR | Growth phase |
| Year 3 (Months 25–36) | 1,250 DR/day | 456,250 DR | Maturity phase |
| Year 4 (Months 37–48) | 625 DR/day | 228,125 DR | Scarcity phase |
| Year 5+ | 312 DR/day | 113,880 DR | Steady state |

**Daily emission** = total DR distributed across all activities, missions, check-ins, and referrals in a 24-hour period. Once the daily cap is reached, no more DR can be earned that day.

This ensures:
- Early participants earn the most (incentive to join now)
- Supply inflation decreases over time
- Combined with wallet caps and earning reductions, DR becomes increasingly scarce

---

## 5. Anti-Hoarding Protections

To ensure fair distribution and prevent any single user from accumulating a disproportionate share:

### 5.1 Wallet Cap
- **Maximum balance: 50,000 DR per user**
- Users cannot earn new DR once their balance reaches this cap
- They must spend (redeem, transfer, or enter hackathons) to earn more
- This does not apply to the team vesting wallets

### 5.2 Earning Reduction
- When a user's balance exceeds **20,000 DR**, their earning rate is reduced:
  - Balance 0–20,000: 100% earning rate (normal)
  - Balance 20,001–35,000: 50% earning rate
  - Balance 35,001–50,000: 25% earning rate
- This encourages spending and circulation

### 5.3 Transfer Fee
- **2% fee on every user-to-user transfer**
- The fee is deducted from the sender and returned to the Treasury
- Example: Sending 1,000 DR costs the sender 1,020 DR (1,000 to recipient + 20 to Treasury)
- This discourages wash trading and artificially inflating activity

### 5.4 Inactivity Decay
- Users inactive for **30+ consecutive days** lose **1% of their balance per month**
- The decayed DR is returned to the Treasury
- Activity is defined as: check-in, logging an activity, completing a mission, or making a transfer
- This prevents dead wallets from locking up supply

### 5.5 Admin Limits
- **Maximum 5,000 DR adjustment per admin per day**
- All admin adjustments are logged with reason and visible in audit trail
- No admin can adjust their own balance
- Multi-admin operations require separate admin accounts

---

## 6. Full Recycling (No Burn)

DR is **not** deflationary. No coins are ever burned or destroyed. Every redeemed coin returns to the treasury in full:

- **100% of every redemption is recycled to treasury**
  - User redeems 1,000 DR for airtime
  - 1,000 DR returns to Treasury
- This keeps the full 21M supply intact and endlessly recyclable

---

## 7. Sustainability — Why We Never Run Out

### The Recycling Loop

1. User earns 200 DR for attending an activity (Treasury → User)
2. User redeems 200 DR for data bundle → 200 DR returns to Treasury
3. The 200 DR can be earned by someone else tomorrow

**Net cost per cycle: 0 DR lost.** All coins are endlessly recyclable.

### Back-of-Envelope Math

- Community Treasury: 15,000,000 DR
- Year 1 max emission: 1,825,000 DR
- Recycling returns 100% of spent DR
- With full recycling + halving emission, the treasury is self-sustaining

### Emergency Mechanisms

If the treasury runs critically low (< 5% of total supply):
1. Emission rate automatically reduces to 100 DR/day
2. Transfer fee increases to 5%
3. Community governance vote on next steps

---

## 8. Transparency & Public Dashboard

All supply metrics are publicly visible to every user:

| Metric | Description |
|---|---|
| Total Supply | Always 21,000,000 DR |
| Treasury Balance | Unissued coins remaining |
| Circulating Supply | Total DR in all user wallets |
| Total Recycled | DR returned to treasury from redemptions |
| Today's Emission | DR distributed today vs. daily cap |
| Daily Cap | Current max daily emission |
| Total Users | Registered user count |
| Avg Balance | Average DR per user |

This dashboard is read-only and cannot be manipulated. It queries real-time data from the database.

---

## 9. Admin Accountability

### What Admins Can Do
- Create activities with DR rewards (deducted from Treasury)
- Create hackathons with prizes (deducted from Hackathon Pool)
- Approve/reject redemption requests
- Adjust user balances (within daily limit, logged)

### What Admins Cannot Do
- Mint new DR beyond the 21M cap
- Exceed the daily emission cap
- Adjust their own balance
- Bypass wallet caps or earning reductions
- Delete or modify the audit log
- Destroy or burn coins (no burn mechanism exists)

### Audit Trail
Every admin action is permanently logged:
- Who performed it
- What was done
- When it happened
- The reason provided
- The DR amount involved

---

## 10. Future: Blockchain Migration Path

The current system runs on Supabase (centralized database) with all supply controls enforced at the application level. This provides fast, fee-less transactions ideal for the growth phase.

When ready, DR can migrate to the **TON blockchain** as a Jetton (TON's token standard):

| Phase | System | Benefit |
|---|---|---|
| Phase 1 (Now) | Supabase + supply controls | Fast UX, zero fees, easy onboarding |
| Phase 2 (Future) | Hybrid (Supabase + TON anchoring) | Periodic supply snapshots on-chain for auditability |
| Phase 3 (Future) | Full TON Jetton | Fully decentralized, tradeable, trustless |

The 21M supply cap, recycling mechanics, and all balances can be mapped 1:1 to the blockchain token, ensuring continuity.

---

## 11. Summary

| Property | Value |
|---|---|
| Token Name | Dreamers Coin |
| Symbol | DR |
| Total Supply | 21,000,000 (fixed) |
| Redemption Recycling | 100% to treasury |
| Transfer Fee | 2% to Treasury |
| Wallet Cap | 50,000 DR per user |
| Daily Emission Cap | 5,000 DR (halves annually) |
| Inactivity Decay | 1%/month after 30 days inactive |
| Admin Daily Limit | 5,000 DR adjustments |
| Earning Reduction | Starts at 20,000 DR balance |

**Core Principles:**
1. **Fixed supply** — 21M DR, never more
2. **Fully circular** — 100% of redemptions recycle back to treasury
3. **No burn** — Every coin lives forever
4. **Fair** — Wallet caps, earning reduction, anti-hoarding
5. **Transparent** — Public supply dashboard, admin audit trail
6. **Sustainable** — Full recycling + emission halving ensures the treasury is self-sustaining

---

*This document defines the economic model for Dreamers Coin (DR). All parameters (supply cap, fees, caps) are enforced programmatically and cannot be overridden without a community governance decision.*

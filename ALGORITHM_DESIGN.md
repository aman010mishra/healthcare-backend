# OPD Token Allocation Algorithm Design

## 1. Prioritization (Highest to Lowest)
1. Emergency
2. Paid Priority
3. Follow-up
4. Online Booking
5. Walk-in

## 2. Token Allocation Steps
- When a token request arrives:
  1. If slot has available capacity, allocate token.
  2. If slot is full:
     - If incoming token has higher priority than the lowest-priority allocated token, preempt (replace) the lowest-priority token (move it to waitlist or reject).
     - Otherwise, reject or waitlist the request.

## 3. Dynamic Reallocation
- On cancellation or no-show:
  - Free up slot and allocate to next highest-priority waitlisted token (if any).
- On emergency insertion:
  - Always allocate, preempting lowest-priority token if full.

## 4. Edge Cases
- Multiple requests with same priority: FIFO (first-come, first-served).
- Cancellations: Token is removed, slot is reallocated.
- No-shows: Mark token, reallocate if possible.
- Emergency: Always inserted, preempt if needed.
- Overlapping slots for same doctor: Not allowed.

## 5. Failure Handling
- If allocation fails (slot full, lower priority), return clear error.
- All actions are atomic (no partial updates).

## 6. Data Structures
- Slot: Maintains ordered list of tokens (by priority, then time).
- Waitlist: For each slot, ordered by priority and request time.

## 7. Example
- Slot capacity: 3
- Bookings: [Online, Walk-in, Priority, Emergency]
- Result: Emergency, Priority, Online (walk-in preempted)

---
This document will guide the implementation of the core allocation logic.

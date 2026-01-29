# OPD Token Allocation Engine - Documentation

## Prioritization Logic

Token allocation is based on the following priority (highest to lowest):
1. Emergency
2. Paid Priority
3. Follow-up
4. Online Booking
5. Walk-in

- Each token source is mapped to a numeric priority (see PRIORITY_MAP in code).
- When a slot is full, higher-priority tokens can preempt (replace) lower-priority tokens.
- If multiple tokens have the same priority, allocation is FIFO (first-come, first-served).

## Edge Cases

- **Cancellations:**
  - When a token is cancelled, it is removed from the slot.
  - The next highest-priority waitlisted token (if any) is allocated to the slot.

- **No-shows:**
  - Marked as 'no_show' and removed from the slot.
  - The next highest-priority waitlisted token is allocated.

- **Emergency Additions:**
  - Always inserted, even if the slot is full.
  - If full, the lowest-priority token is preempted and moved to the waitlist.

- **Overlapping Slots:**
  - Not allowed for the same doctor (should be validated at slot creation).

- **Multiple Requests with Same Priority:**
  - Handled in FIFO order (earliest createdAt wins).

## Failure Handling

- All API endpoints return clear error messages on failure (e.g., slot or patient not found, slot full, etc.).
- All allocation and reallocation actions are atomic (no partial updates).
- Preemption and waitlisting are handled transparently by the backend.

## Practical Reasoning & Trade-offs

- **Elastic Capacity:**
  - The system can dynamically reallocate tokens as cancellations, no-shows, or emergencies occur.
- **Fairness:**
  - Priority and FIFO ensure fairness and responsiveness to real-world needs.
- **Performance:**
  - In-memory and MongoDB operations are optimized for quick lookups and updates.
- **Extensibility:**
  - The design supports adding new token sources or rules with minimal changes.

---
See API_DESIGN.md and ALGORITHM_DESIGN.md for further details on endpoints and logic.

# Security Specification

## Data Invariants
- A User document must match the authenticated user's UID.
- A Gig must have a valid authorId matching the creator.
- Notifications are private to the recipient (userId).
- Topups and Cashouts are private to the requester and visible to admins.
- Feedbacks are created by authenticated users and readable only by admins.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing (Users)**: Try to create/update a user profile with a different UID.
2. **Privilege Escalation (Users)**: Try to set `isAdmin: true` during self-registration.
3. **Orphaned Gig**: Create a gig with an `authorId` that doesn't match the current user.
4. **Gig Hijacking**: Update a gig owned by another user.
5. **Unauthorized Marketplace Cleanup**: Try to delete all gigs as a non-admin.
6. **Notification Snooping**: Try to read notifications belonging to another user.
7. **Feedback Leak**: Read all feedbacks as a non-admin.
8. **Wallet Manipulation**: Update another user's balance directly.
9. **Topup Forgery**: Create a topup request for another user's ID.
10. **State Shortcut (Topup)**: Directly set a topup to 'approved' as a regular user.
11. **Cashout Forgery**: Create a cashout request for another user.
12. **System Field Poisoning**: Inject oversized strings or invalid types into any field.

## The Test Runner
(Tests would be implemented in `firestore.rules.test.ts` if environment supported it)

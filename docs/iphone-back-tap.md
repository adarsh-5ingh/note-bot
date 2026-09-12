# iPhone Back Tap expense entry

## Implemented plan

- Add one revocable Shortcut credential per Note Bot user, stored as a SHA-256 hash. Credentials expire after one year; replacement invalidates the previous credential.
- Add an expense-only endpoint using the existing Expense collection. The credential cannot access normal JWT-protected APIs or manage its own connection.
- Deduplicate requests by user and UUID using a partial unique MongoDB index. Identical retries return the original result; conflicting payloads return 409.
- Add Expenses → iPhone Back Tap (`/expenses/shortcuts`) with credential management, copyable endpoint/header values, and the complete manual Shortcut recipe.
- Refresh expenses when the page becomes visible, so entries added outside the app appear on return.

The Shortcut asks for amount, description and category. It records INR expenses with the chosen category (default `other` when omitted) and the iPhone's local calendar date. No native iOS build is required. The user must create the Shortcut and assign Back Tap on their phone; the web app cannot configure iOS Settings.

## API contract

Normal Note Bot JWT authentication is required for:

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/shortcuts/credential` | Connection expiry or null; never returns a secret |
| POST | `/api/shortcuts/credential` | Creates/replaces the connection; returns token once |
| DELETE | `/api/shortcuts/credential` | Revokes connection, returns 204 |

`POST /api/shortcuts/expenses` requires `Authorization: Bearer nbsc_…` and a JSON body:

```json
{
  "amount": 150.5,
  "description": "Lunch",
  "category": "food",
  "date": "2026-09-12",
  "requestId": "ae80bf79-9a77-4714-a3ca-86ec05c95939"
}
```

- Amount must be a finite JSON number greater than zero and at most 1,000,000,000.
- Description must contain 1–500 characters after trimming.
- Category is optional and defaults to `other`. Supply an exact key from your expense categories, not its display label. The setup page lists your keys. Custom categories are validated against the credential owner's settings; `other` is always available. Unknown categories return 400. Category changes with the same request ID return 409; old requests that omitted category can still be replayed.
- Date must be a valid `yyyy-MM-dd` date. The phone supplies its local date; storage uses UTC midnight to match existing date-only expense entries.
- Request ID must be a UUID and must remain unchanged across retries of the same payload. Uppercase and lowercase UUIDs are equivalent.
- The server derives the user from the credential and fixes type to `expense`. Caller-supplied user, type and notes do not override these.
- Successful creation returns 201; replay returns 200. Both include `saved: true`, `id`, `amount`, `description`, and a human-readable `message`.
- Validation errors return 400; invalid/revoked/expired credentials return 401; conflicting reuse of an ID returns 409; server errors return 500. Errors include `message` and never `saved: true`.

## iPhone setup

1. Open Note Bot → Expenses → iPhone Back Tap and create a connection. Copy the full Authorization value. The raw token is displayed only in component memory and is not retained in browser storage.
2. In Apple Shortcuts, create **Add Note Bot Expense**.
3. Add **Ask for Input**, prompt “How much?”, type Number. Name the output **Amount**.
4. Add **Ask for Input**, prompt “What for?”, type Text. Name the output **Description**. Then add **List** with the exact category keys shown on the Note Bot setup page as separate items (for example `food`, `dining`, `transport`, `shopping`, `other`). Add **Choose from List**, select the List output, prompt “Category”, and disable Select Multiple. Name its output **Category**. Update the List manually when you change custom categories in Note Bot.
5. Add **Current Date → Format Date**, Custom format `yyyy-MM-dd`, local timezone. Name the output **Expense Date**.
6. Install and open [Actions by Sindre Sorhus](https://sindresorhus.com/actions), then add its **Generate UUID** action in Shortcuts. Name the output **Request ID**.
7. Add **Get Contents of URL**, using the endpoint copied from the setup page. Set POST, add the Authorization header, and select JSON request body. Map `amount` (Number), `description` (Text), `category` (Text), `date` (Text), and `requestId` (Text) to the five output variables.
8. Add **Get Dictionary Value** for `message` from the HTTP result, then **Show Alert** with that value. Do not hard-code a success message.
9. Run once and approve the iPhone's API access prompt. Verify the expense appears in Note Bot.
10. Open Settings → Accessibility → Touch → Back Tap → Double Tap and select the Shortcut.

Keep the credential private and remove it before sharing the Shortcut. A lost credential can be replaced in Note Bot. Each fresh Shortcut run creates a new ID, so after an ambiguous network failure check Expenses before starting another run. An automatic retry must reuse the original ID, date, amount, description and category; this manual recipe does not implement an offline queue or persistent retry workflow.

## Deployment

Deploy backend and frontend together, backend first. No new dependencies or environment variables are needed. The frontend uses the existing `NEXT_PUBLIC_API_URL`; for a phone this must be a publicly reachable HTTPS backend, not localhost.

Mongoose's existing default automatic index creation provisions the new credential indexes and Expense partial unique index. The Shortcut endpoint waits for `Expense.init()` before accepting a write. If automatic indexing is disabled in a deployment, explicitly provision the indexes before enabling this feature:

```javascript
db.shortcutcredentials.createIndex({ userId: 1 }, { unique: true });
db.shortcutcredentials.createIndex({ tokenHash: 1 }, { unique: true });
db.expenses.createIndex(
  { userId: 1, shortcutRequestId: 1 },
  { unique: true, partialFilterExpression: { shortcutRequestId: { $type: "string" } } }
);
```

Existing expenses have no Shortcut request ID and are excluded from the unique index. No backfill is required. No deployment or production database writes are performed by the tests.

## Validation and remaining device checks

Run `npm test` in backend for HTTP tests using in-memory model substitutes and the real JWT middleware. Tests cover authentication, credential lifecycle, ownership, invalid input, dates, retries, conflicts and server errors. A schema assertion checks the database index declaration; these tests do not verify index creation against a running MongoDB server.

Run `npx tsc --noEmit` and `npm run build` in frontend. The new setup screen can also be linted independently with `npx eslint app/expenses/shortcuts/page.tsx`.

Before release, verify on an actual iPhone:

- Input prompts and first-run permissions; successful save appears in Expenses.
- Canceling either prompt creates no expense.
- Invalid amount, replaced/disconnected credential, and slow/unavailable network show no false success.
- Same-ID retries create exactly one document against the deployed MongoDB index.
- Correct local date around midnight, including Asia/Kolkata.
- Switching back to an already-open Note Bot refreshes the list.
- Unlocked, locked and screen-off behavior; unlocking may be required. Confirm Back Tap support on the target model/iOS version.

## Apple references

- [Run shortcuts with Back Tap](https://support.apple.com/en-ca/guide/shortcuts/apd897693606/ios)
- [Ask for Input](https://support.apple.com/en-au/guide/shortcuts/apd68b5c9161/ios)
- [POST JSON with Get Contents of URL](https://support.apple.com/en-au/guide/shortcuts/apd58d46713f/ios)
- [Custom date formats](https://support.apple.com/en-ie/guide/shortcuts/apd8d9b19184/ios)

Category selection uses Apple’s [List and Choose from List actions](https://support.apple.com/en-lamr/guide/shortcuts/apd4dcacc115/ios). Existing credentials remain valid; no token replacement or database migration is needed for category support.

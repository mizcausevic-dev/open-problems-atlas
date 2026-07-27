# Security

## Reporting

Report suspected vulnerabilities through GitHub's private advisory form:
[Report a vulnerability](https://github.com/mizcausevic-dev/open-problems-atlas/security/advisories/new).

Please do not open a public issue for anything that affects the confidentiality of a user's stored
notes. Expect an acknowledgement within about a week; this is a personal project, not a staffed
product, and that response window is stated so it can be relied on rather than assumed.

## What this application is

A static site. No backend, no accounts, no database, no session, and no server-side code of any
kind. There is nothing to authenticate to and no user data held anywhere but the visitor's own
browser. That removes most of the usual attack surface, and it means the remaining surface is worth
being precise about.

## Outbound requests

Exactly one, and only when the visitor asks for it: a `GET` to the Wikimedia pageviews API, made
when the *Load* button on a problem page is pressed. Nothing else leaves the browser. No analytics,
no cookies, no fonts from a CDN, no embedded third-party frames. The Content-Security-Policy in
`public/.htaccess` enumerates this, so if it ever stops being true the header breaks first.

## Where the interesting surface actually is

**The encrypted vault** (`src/lib/crypto.ts`). AES-256-GCM with a key derived by PBKDF2-HMAC-SHA-256
at 600,000 iterations, all in the browser. The passphrase is never stored and never transmitted.

What it protects against: someone with read access to the browser profile — a shared machine, a
synced backup, a copied export file — cannot read the notes without the passphrase.

What it does not protect against: code running inside the page, a compromised browser or operating
system, or a keylogger. Nothing client-side can. It is **encryption at rest**, and it is called that
rather than "end-to-end", because end-to-end describes a message in transit between two parties and
this has neither.

There is no recovery. No server holds a copy and no reset exists, because there is no account. A
forgotten passphrase means the notes are gone. This is stated in the UI at the point of use.

**The expression evaluator** (`src/lib/math/expression.ts`). User input is tokenised, parsed to an
AST and walked by an interpreter. There is no `eval` and no `new Function`, and nothing a visitor
types can reach the JavaScript runtime.

One real bug was found here during development and is worth recording, because the same mistake is
easy to repeat: name lookup used the `in` operator, which walks the prototype chain, so typing
`constructor` resolved to `Object.prototype.constructor` and returned a function where a number was
expected. It is now `Object.hasOwn` throughout, and `expression.test.ts` carries a hostile-input
suite asserting that `constructor`, `__proto__`, `globalThis`, `require("fs")` and friends all fail.

**Rendered mathematics** (`src/components/Tex.tsx`). KaTeX output reaches the DOM through
`dangerouslySetInnerHTML`. The string is produced by KaTeX itself from the maths source with
`trust: false`, so no author-supplied HTML or URL can pass through it. Notes are the visitor's own
and are never shared between users, so there is no stored-XSS path — but if any feature ever makes
one visitor's notes visible to another, this is the first thing to re-examine.

**Dependencies.** Five in production: `react`, `react-dom`, `katex`, `lucide-react`, `motion`. A
small surface is deliberate.

## Scope

In scope: anything that could expose a visitor's stored notes, execute code from user input, or
misrepresent the data as coming from a source it did not.

Out of scope: the absence of features that are documented as deliberately absent on the About page
(accounts, sync, server-side storage), and the fact that data in `localStorage` is readable by
anyone with access to the browser profile when the vault is switched off — that is stated in the UI
and is the documented default.

## A note on wording

This project does not describe itself as "compliant" or "certified" with anything. What is written
here is an account of how it is built and what it does, which is checkable against the source.

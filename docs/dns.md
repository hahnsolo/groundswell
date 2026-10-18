# DNS (GoDaddy)

DNS is the internet's address book. It turns `groundswell.hahnsolo.ca` into "the server at Vercel" and tells other mail servers that Resend is allowed to send email for us.

Records are managed at GoDaddy → **My Products → hahnsolo.ca → DNS**.

## The golden rule

**Everything Groundswell needs lives under `groundswell`.** We never added, changed or removed anything at the root (`@`) of `hahnsolo.ca`. Your website, Microsoft 365 email and other services keep working exactly as before.

In GoDaddy's **Name** column, Groundswell's records all contain `groundswell`. If a record's name doesn't contain `groundswell`, it isn't ours, so leave it alone.

## Records we added

These were checked against live DNS on 18 October 2026.

| Type | Name (as typed in GoDaddy) | Points to / value | Added for | Why |
|---|---|---|---|---|
| CNAME | `groundswell` | `6691ecb42f2d4ccc.vercel-dns-017.com` | Vercel | Sends visitors of `groundswell.hahnsolo.ca` to Vercel. Vercel also uses it to issue the HTTPS certificate. The value is specific to our Vercel project (Vercel → Settings → Domains shows it). |
| CNAME | `send.groundswell` | `send.forge.rmta.net` | Resend | The "return address" domain for bounces. It lets Resend handle bounce reports and publishes Resend's permission to send (SPF) on our behalf. |
| TXT | `resend._domainkey.groundswell` | `p=MIGf…` (a long public key from Resend) | Resend | DKIM: a digital signature on every email, so inboxes can tell it really came from us and wasn't tampered with. |
| TXT | `_dmarc.groundswell` | `v=DMARC1; p=none;` | Email reputation | Tells inboxes we have an email policy. `p=none` means "watch, don't block," a safe starting point. Gmail and Yahoo expect a DMARC record from senders. |

Notes:

- Resend's dashboard may describe its records as an MX and a TXT on `send.groundswell`. Our setup uses a single CNAME on `send.groundswell` instead, which delivers the same thing (Resend's bounce server and SPF) and keeps itself up to date. Resend shows the domain as **Verified**, so it's correct as it is.
- GoDaddy adds `.hahnsolo.ca` to whatever you type in **Name**, so you type `send.groundswell`, not `send.groundswell.hahnsolo.ca`.
- The DKIM value is a *public* key. It's not a secret, but don't retype it by hand. If it ever needs changing, copy it from Resend → Domains.

## Records you must never touch

These were there before Groundswell and run your other services. Changing or deleting any of them can break your email or website, sometimes in ways that take hours to show up.

| Type | Name | What it does |
|---|---|---|
| **MX** | `@` | Delivers email for `@hahnsolo.ca` to Microsoft 365 (`hahnsolo-ca.mail.protection.outlook.com`). **Deleting this stops your email arriving.** |
| **TXT** | `@` | `NETORG…onmicrosoft.com`: proves to Microsoft that you own the domain. |
| **TXT** | `@` | `v=spf1 …`: the list of servers allowed to send `@hahnsolo.ca` email. There must only ever be **one** SPF record at `@`. Don't add a second one for Resend; Resend's SPF lives under `send.groundswell`. |
| **CNAME** | `autodiscover` | Lets Outlook and phones set up your mailbox automatically. |
| **CNAME** | `lyncdiscover`, `sip` | Microsoft Teams/Skype sign-in. |
| **CNAME** | `email` | GoDaddy's webmail shortcut. |
| **A** | `@` | Your main `hahnsolo.ca` website. |
| **CNAME** or **A** | `www` (if present) | Usually points `www.hahnsolo.ca` at the main site. |
| **NS** / **SOA** | `@` | Which DNS service is in charge. GoDaddy usually locks these. **Never change.** |

Others may exist too, such as `_domainconnect` or Microsoft records starting with `enterpriseregistration` or `enterpriseenrollment`. Same rule: if the name doesn't contain `groundswell`, leave it.

## Safe habits

- **Before changing anything, take a screenshot** of the whole DNS page. It's your undo button.
- Change one record at a time, then wait. DNS changes take anywhere from a few minutes to an hour (sometimes longer) to spread.
- When GoDaddy offers to "fix" or "auto-configure" records for a service, say no unless you're sure what it will change.
- To check what the world sees, use a lookup site such as [dnschecker.org](https://dnschecker.org) and enter, for example, `groundswell.hahnsolo.ca` with type CNAME.

## If you ever remove Groundswell

Delete just the four records in the "Records we added" table, remove the domain in Vercel and Resend, and you're back where you started.

# Store listing — naming/trademark screen + ASO copy pack (T102)

## 1. **Purpose** & scope

This document is the T102 deliverable: a point-in-time, evidence-backed
**preliminary** naming/trademark screen for the display name
`Bombay Pet Company` (identifiers `bombaypetcompany` / `com.bombaypetcompany.app`
per `CLAUDE.md` §1a), plus two verified fallback candidates, three named
risk assessments with a per-store go/no-go, a geographic-name risk
mitigation plan, and an App Store Connect / Play Console ASO listing copy
pack.

What this document **is not**:

- It is **not** `docs/store-setup.md` — that document covers console
  mechanics (product ids, prices, RevenueCat wiring). This document covers
  the app **name** and the **listing copy**, not console configuration.
- It is **not** `docs/store-privacy.md` — that document covers data-safety
  declarations. This document does not touch privacy labels.
- It is **not** a trademark clearance opinion and **not legal advice**. See
  §2 for the honesty statement that governs every verdict below.
- It changes **no identifier**. `APP_DISPLAY_NAME`, the `bombaypetcompany`
  slug, `com.bombaypetcompany.app`, the `bombaypetcompany://` scheme, and
  every other derivative in `CLAUDE.md` §1a remain exactly as they are
  today. Any rename is a separate, future task gated on the founder's C3
  decision (see §6).

All factual claims below are transcribed verbatim from the research
dossier produced by a separate, web-capable research agent
(`/tmp/claude-0/-home-user-Paw-Care-Right/T102-name-research-dossier.md`,
session of 2026-07-29, outside this repo, never committed). No fact in
this document was invented, inferred, or recalled from training data — a
row is either transcribed from the dossier with its source URL and UTC
timestamp, or marked `NOT-VERIFIED`/`BLOCKED` exactly as the dossier
recorded it.

---

## 2. **Honesty** & limitations

These results are point-in-time, non-legal, preliminary screening
evidence gathered by an automated agent. They are not a trademark
clearance opinion and are not legal advice. Every go/no-go verdict in §4
below is a **preliminary screen, not legal advice**. Final trademark
clearance requires `[FOUNDER]` legal review by qualified counsel before
any filing, and `[FOUNDER]` legal review before any public store listing
that names `Bombay Pet Company` is treated as final.

**Substitutions made by the orchestrator, surfaced here for founder
review (not silently applied):**

- **S1 — jurisdiction swap.** The stale task card (`docs/PHASES.md:495-499`)
  named **Algeria INAPI**. This screen instead researched the **India IP
  Office (CGPDTM)** register, because the Bombay/India connection of the
  new display name is where geographic and same-class collision risk
  actually lives. **Algeria INAPI was not researched in this task.** If
  Algeria remains a launch market, that lookup is still owed.
- **S2 — risk #2 replaced.** The stale card's risk #2 (store handling of
  the literal `+` and spaces in the old display name) is now moot: the
  current display name `Bombay Pet Company` contains no `+`. It has been
  replaced by **geographic-term registrability risk** (see §4 R2). The
  18-character title length is recorded as a measured fact against the
  30-character store cap, not as a risk.

**Every `NOT-VERIFIED` / `BLOCKED` lookup carried over from the dossier
§7 (verbatim list, for a human to re-run before relying on this screen):**

1. USPTO structured trademark register — **BLOCKED** for all 5 candidates
   (`tmsearch.uspto.gov` is a JS single-page app with no data without JS
   execution; the API probe returned HTTP 405). No authoritative USPTO
   word-mark screen exists in this document.
2. EUIPO eSearch — **BLOCKED** for all 5 candidates (JS shell, no data
   without JS; TMview API fallback failed with a connection reset).
3. India CGPDTM Public Search — **BLOCKED** for all 5 candidates (S1
   jurisdiction). The search form requires a numeric CAPTCHA plus a
   6-digit email OTP, which an automated agent cannot and must not
   complete.
4. Algeria INAPI — **NOT RESEARCHED** (S1 substitution; deliberately
   skipped, flagged above for the founder).
5. Apple's human-readable search page — **BLOCKED** (HTTP 429 then 404 to
   a non-JS client); the machine-readable iTunes Search API was used
   instead and succeeded.
6. The Emblems and Names (Prevention of Improper Use) Act, 1950 Schedule —
   **NOT-VERIFIED** on the primary PDF (indiacode.nic.in returned an
   HTML/JS redirect instead of the document, twice). Secondary summaries
   suggest the Schedule covers national/UN emblems and named leaders, not
   city names — **unconfirmed against the primary text**.
7. India Trade Marks Act 1999 §9(1) — primary indiacode page returned
   HTTP 503; the statutory text was captured only via secondary sources
   quoting the official PDF.
8. MCA Companies (Incorporation) Rules, 2014 city-name position —
   **NOT-VERIFIED**; secondary summaries only, primary rule text not
   fetched.
9. Apple app description character limit and Google Play full-description
   character limit — **NOT-VERIFIED on the primary Apple/Google pages
   fetched**; secondary sources report 4,000 characters for both, and
   that conventional value is what this document's listing pack uses
   (see §5).
10. SNOUTLY US trademark registration's live/dead status —
    **NOT-VERIFIED** (registration number surfaced via a secondary Justia
    snippet only; TSDR status could not be checked because USPTO is
    BLOCKED; a direct Justia fetch returned HTTP 403).
11. The registrant identity behind `bombaypetcompany.com` (registered
    2026-07-19, ten days before this screen) — **NOT-VERIFIED**. RDAP
    shows only the registrar (NameCheap, Inc.) and the registration date;
    whether the founder or a third party registered it is unknown to this
    screen. **This is a founder action item, see §6.**
12. Apple App Review Guidelines §2.3 (app-name rules) — **NOT-VERIFIED**;
    not fetched, only the App Store Connect reference and product-page
    guide were checked for name restrictions.
13. The Trademarkia "bombay" sweep — only page 1 of 33 result pages was
    reviewed; pages 2-33 are **NOT REVIEWED**.

This is a snapshot, not a standing state. See §7 for the re-verification
procedure.

---

## 3. **Evidence** tables

Row format: `| Channel | Verdict | Source (URL) | UTC date |`. Every row
below is transcribed from the dossier; a `BLOCKED`/`NOT-VERIFIED` verdict
is a legitimate, expected, and recorded outcome, never silently dropped.
Nice classes screened: **9** (downloadable software), **35**
(advertising/retail), **42** (SaaS). **Class 44 (veterinary services) is
deliberately excluded from the filing intent** — this product offers
guidance, never veterinary care, and does not intend to file in class 44.

### 3.1 Primary — `Bombay Pet Company`

| Channel | Verdict | Source (URL) | UTC date |
|---|---|---|---|
| Apple iTunes Search API, US/IN/GB/DE, exact name + `bombay pet` + `bombaypetcompany` (12 queries) | CLEAR — 0 apps whose name contains "Bombay" alongside a pet term across all 12 queries | https://itunes.apple.com/search?term=Bombay%20Pet%20Company&entity=software&limit=50&country=US | 2026-07-29 18:07 UTC |
| Apple human-readable search page cross-check | BLOCKED — HTTP 429 then HTTP 404 to non-JS client; iTunes API row above is the Apple evidence of record | https://apps.apple.com/us/search?term=bombay%20pet%20company | 2026-07-29 18:16-18:18 UTC |
| Google Play search, US/IN, exact name + `bombay pet` + `bombaypetcompany` (6 queries) | CLEAR — 0 app titles containing "Bombay"+pet across the result sets | https://play.google.com/store/search?q=Bombay+Pet+Company&c=apps&hl=en&gl=US | 2026-07-29 18:08 UTC |
| Google Play package-id probe `com.bombaypetcompany.app` | CLEAR — HTTP 404, id unused | https://play.google.com/store/apps/details?id=com.bombaypetcompany.app | 2026-07-29 18:08 UTC |
| USPTO structured trademark register (word mark + bare `BOMBAY`, classes 9/35/42/44) | BLOCKED — JS SPA, no data without JS; API probe HTTP 405 | https://tmsearch.uspto.gov/search/search-information | 2026-07-29 18:13 UTC |
| USPTO secondary signal (Trademarkia, NOT the register) | PARTIAL (secondary only) — "BOMBAY SHIRT COMPANY" (apparel), "Bombay Company" (furniture, Wikipedia); no "Bombay Pet" mark surfaced | https://www.trademarkia.com/search/trademarks?query=bombay | 2026-07-29 18:18 UTC |
| USPTO secondary signal, well-known unrelated-class marks (Justia) | PARTIAL (secondary; direct search fetch 403) — "BOMBAY" reg. #1272741 (furniture, Senior Brands LLC); "BOMBAY SAPPHIRE" reg. #2329989, class 033 (Bacardi & Company Limited) | https://trademarks.justia.com/733/69/bombay-73369588.html | 2026-07-29 18:16 UTC |
| EUIPO eSearch (word mark) | BLOCKED — 13 KB JS shell, no results without JS; TMview API fallback connection reset | https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/bombay%20pet%20company | 2026-07-29 18:13 UTC |
| India CGPDTM Public Search (S1 substitution for Algeria INAPI) | BLOCKED — numeric CAPTCHA + 6-digit email OTP wall | https://tmrsearch.ipindia.gov.in/tmrpublicsearch/ | 2026-07-29 18:13 UTC |
| India — Emblems and Names (Prevention of Improper Use) Act, 1950 Schedule | NOT-VERIFIED — primary PDF returned an HTML/JS redirect (HTTP 302, 2 attempts); secondary summaries suggest no city-name restriction, unconfirmed | https://www.indiacode.nic.in/bitstream/123456789/1896/1/aA1950-12.pdf | 2026-07-29 18:17 UTC |
| India — MCA Companies (Incorporation) Rules, 2014, city-name position | NOT-VERIFIED — secondary summaries only, primary rule text not fetched | https://ca2013.com/rule-8-companies-incorporation-rules-2014/ | 2026-07-29 18:18 UTC |
| Statutory citation — US Lanham Act §2(e)(2)/(e)(3) | CITATION CAPTURED — geographically descriptive / deceptively misdescriptive refusal grounds | https://www.law.cornell.edu/uscode/text/15/1052 | 2026-07-29 18:14 UTC |
| Statutory citation — EUTMR Art. 7(1)(b)/(c) | CITATION CAPTURED — devoid-of-distinctiveness / exclusively-descriptive refusal grounds | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017R1001 | 2026-07-29 18:14 UTC |
| Statutory citation — India Trade Marks Act 1999 §9(1) | CITATION CAPTURED (primary page HTTP 503; text via secondary quoting the primary PDF) — descriptive/geographical-origin refusal ground, with an acquired-distinctiveness proviso | https://www.indiacode.nic.in/bitstream/123456789/15427/1/the_trade_marks_act,_1999.pdf | 2026-07-29 18:15 UTC |
| Domain `bombaypetcompany.com` (RDAP) | COLLISION — HTTP 200, REGISTERED, registrar NameCheap Inc., registration event 2026-07-19T10:47:09Z (10 days before this screen; registrant unknown) | https://rdap.org/domain/bombaypetcompany.com | 2026-07-29 18:11 UTC |
| Domain `bombaypetcompany.app` (RDAP) | CLEAR — HTTP 404, UNREGISTERED | https://rdap.org/domain/bombaypetcompany.app | 2026-07-29 18:11 UTC |
| Host resolution `bombaypetcompany.app` | CLEAR (fact recorded) — NXDOMAIN, does not resolve today | https://dns.google/resolve?name=bombaypetcompany.app&type=A | 2026-07-29 18:12 UTC |
| Host resolution `staging-api.bombaypetcompany.app` | COLLISION with C3 expectation — NXDOMAIN, does not resolve today; `loop/checkpoint-C3-notes.md` already treats this as a hard blocker | https://dns.google/resolve?name=staging-api.bombaypetcompany.app&type=A | 2026-07-29 18:12 UTC |
| "Bombay" cat breed genericness input (CFA, primary registry) | PARTIAL (fact only, no legal conclusion) — the Bombay is a CFA-registered domestic-shorthair cat breed since 1970; may function descriptively in a cat-goods context | https://cfa.org/breed/bombay/ | 2026-07-29 18:15 UTC |

### 3.2 Fallback FB-A — `Nuzzo`

| Channel | Verdict | Source (URL) | UTC date |
|---|---|---|---|
| Apple iTunes Search API, US/IN/GB/DE | COLLISION — whole-word hit "Nuzzo: Pet Plant Safety" (seller Nasser Farhat, `com.nasser.nuzzo`, a pet-sector plant-safety app) present in all 4 storefronts | https://itunes.apple.com/search?term=Nuzzo&entity=software&limit=50&country=US | 2026-07-29 18:07 UTC |
| Google Play search, US/IN | CLEAR — 0 titles containing whole word "Nuzzo" | https://play.google.com/store/search?q=Nuzzo&c=apps&hl=en&gl=US | 2026-07-29 18:08-18:09 UTC |
| USPTO structured register | BLOCKED (same wall as §3.1) | https://tmsearch.uspto.gov/search/search-information | 2026-07-29 18:13 UTC |
| EUIPO eSearch | BLOCKED (same wall as §3.1) | https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/nuzzo | 2026-07-29 18:13 UTC |
| India CGPDTM | BLOCKED (same wall as §3.1) | https://tmrsearch.ipindia.gov.in/tmrpublicsearch/ | 2026-07-29 18:13 UTC |
| Trademark secondary signal | NOT-VERIFIED (secondary absence only; registers blocked) — no direct trademark registration surfaced for "Nuzzo" as a standalone mark | (search-engine results only — no primary register or single stable URL; dossier records one combined "Nuzzo"/"Pawnest" lookup) | 2026-07-29 18:17 UTC |
| Domain `nuzzo.com` (RDAP) | COLLISION — REGISTERED, registrar Tucows Domains Inc., registration 1999-03-05 | https://rdap.org/domain/nuzzo.com | 2026-07-29 18:11 UTC |
| Domain `nuzzo.app` (RDAP) | COLLISION — REGISTERED, registrar Key-Systems LLC, registration 2026-05-30 (recent) | https://rdap.org/domain/nuzzo.app | 2026-07-29 18:11 UTC |

### 3.3 Fallback FB-B — `Snoutly`

| Channel | Verdict | Source (URL) | UTC date |
|---|---|---|---|
| Apple iTunes Search API, US/IN/GB/DE | COLLISION (severe) — direct hit "Snoutly: AI Pet Health Tracker" (seller Tailwise Solutions Yazilim Hizmetleri Limited Sirketi, `com.tailwisesolutions.snoutly`, Health & Fitness), identical name, identical AI-pet-health sector | https://itunes.apple.com/search?term=Snoutly&entity=software&limit=50&country=US | 2026-07-29 18:07 UTC |
| Google Play search, US/IN | COLLISION — direct hit "Snoutly: Discover dog breeds" (`dev.dacape.snoutly`); "SnoutIQ"/`com.petai.snoutiq` also present in India results | https://play.google.com/store/search?q=Snoutly&c=apps&hl=en&gl=US | 2026-07-29 18:08 UTC |
| USPTO structured register | BLOCKED (same wall as §3.1) | https://tmsearch.uspto.gov/search/search-information | 2026-07-29 18:13 UTC |
| USPTO secondary signal (Justia) | COLLISION — "SNOUTLY Trademark of SNOUTLY, LLC — Registration Number 5325738" registered 2017 for pet food/treats/chews; live/dead status NOT-VERIFIED (USPTO blocked, Justia direct fetch 403) | https://trademarks.justia.com/873/16/snoutly-87316370.html | 2026-07-29 18:16 UTC |
| EUIPO eSearch | BLOCKED (same wall as §3.1) | https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/snoutly | 2026-07-29 18:13 UTC |
| India CGPDTM | BLOCKED (same wall as §3.1) | https://tmrsearch.ipindia.gov.in/tmrpublicsearch/ | 2026-07-29 18:13 UTC |
| Domain `snoutly.com` (RDAP) | COLLISION — REGISTERED, registrar GoDaddy.com LLC, registration 2016-09-19 | https://rdap.org/domain/snoutly.com | 2026-07-29 18:11 UTC |
| Domain `snoutly.app` (RDAP) | COLLISION — REGISTERED, registrar GoDaddy.com LLC, registration 2025-01-16, matches a live "Snoutly: Best Pet Health Tracker App" product site | https://rdap.org/domain/snoutly.app | 2026-07-29 18:11 UTC |

### 3.4 Fallback FB-C — `Tailwise`

| Channel | Verdict | Source (URL) | UTC date |
|---|---|---|---|
| Apple iTunes Search API, US/IN/GB/DE | COLLISION — direct hit "Tailwise" (seller Pawfect Services Ltd, `com.tailwise.community`, GB); "TailWise Companion" (`com.tailwiseapp.companion`); seller "Tailwise Solutions" already trades a pet-health app under this name (see §3.3) | https://itunes.apple.com/search?term=Tailwise&entity=software&limit=50&country=US | 2026-07-29 18:07 UTC |
| Google Play search, US/IN | CLEAR (Play server-HTML title match only) — 0 exact-title hits in server HTML, though fuzzy pet-adjacent matches present | https://play.google.com/store/search?q=Tailwise&c=apps&hl=en&gl=US | 2026-07-29 18:09 UTC |
| Play + web secondary signal | COLLISION — "YL TailWise Care" (`com.yl.tail.wise.care.app`, a dog-owner management/reminders/health-data app) and "TailWise" (tailwiseapp.com, a platform for groomers/trainers/pet-care professionals), both active pet-sector products | https://play.google.com/store/apps/details?id=com.yl.tail.wise.care.app | 2026-07-29 18:16 UTC |
| USPTO structured register | BLOCKED (same wall as §3.1) | https://tmsearch.uspto.gov/search/search-information | 2026-07-29 18:13 UTC |
| EUIPO eSearch | BLOCKED (same wall as §3.1) | https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/tailwise | 2026-07-29 18:13 UTC |
| India CGPDTM | BLOCKED (same wall as §3.1) | https://tmrsearch.ipindia.gov.in/tmrpublicsearch/ | 2026-07-29 18:13 UTC |
| Domain `tailwise.com` (RDAP) | COLLISION — REGISTERED, registrar 1API GmbH, registration 2017-01-03 | https://rdap.org/domain/tailwise.com | 2026-07-29 18:11 UTC |
| Domain `tailwise.app` (RDAP) | COLLISION — REGISTERED, registrar Namecheap Inc., registration 2025-07-17 | https://rdap.org/domain/tailwise.app | 2026-07-29 18:12 UTC |

### 3.5 Fallback FB-D — `Pawnest`

| Channel | Verdict | Source (URL) | UTC date |
|---|---|---|---|
| Apple iTunes Search API, US/IN/GB/DE | CLEAR — 0 whole-word "Pawnest" titles; all hits are unrelated pawn-shop/finance/game apps | https://itunes.apple.com/search?term=Pawnest&entity=software&limit=50&country=US | 2026-07-29 18:07 UTC |
| Google Play search, US/IN | COLLISION — two direct hits: `com.pawnest.petzone` ("PawNest — pet grooming booking app") and `com.hector.pawnest` (Spanish-language pet-profile/record app); "The PetNest" (India) also present in results | https://play.google.com/store/search?q=Pawnest&c=apps&hl=en&gl=US | 2026-07-29 18:09 UTC |
| USPTO structured register | BLOCKED (same wall as §3.1) | https://tmsearch.uspto.gov/search/search-information | 2026-07-29 18:13 UTC |
| Trademark secondary signal | NOT-VERIFIED (secondary absence only; registers blocked) — no trademark registration surfaced for "Pawnest" | (search-engine results only — no primary register or single stable URL; dossier records one combined "Nuzzo"/"Pawnest" lookup) | 2026-07-29 18:17 UTC |
| EUIPO eSearch | BLOCKED (same wall as §3.1) | https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/pawnest | 2026-07-29 18:13 UTC |
| India CGPDTM | BLOCKED (same wall as §3.1) | https://tmrsearch.ipindia.gov.in/tmrpublicsearch/ | 2026-07-29 18:13 UTC |
| Domain `pawnest.com` (RDAP) | COLLISION — REGISTERED, registrar NameCheap Inc., registration 2018-11-22 | https://rdap.org/domain/pawnest.com | 2026-07-29 18:12 UTC |
| Domain `pawnest.app` (RDAP) | COLLISION — REGISTERED, registrar Namecheap Inc., registration 2026-05-07 | https://rdap.org/domain/pawnest.app | 2026-07-29 18:12 UTC |

### 3.6 Verified fallbacks recorded

Of the four researched fallbacks, none is collision-free: every candidate
shows at least one app-store or domain collision in §3.2-§3.5 above. The
two candidates recorded as the **verified fallback** set — i.e. the two
with the narrowest, most clearly-distinguishable collisions among the
four, carried forward for possible C3 consideration — are **Nuzzo** and
**Pawnest**:

- `Nuzzo` has exactly one Apple-side collision (a plant-safety niche app,
  functionally distinct from symptom/health guidance) and a clean Google
  Play result; its trademark registers are all BLOCKED (not clear, not
  ruled out).
- `Pawnest` has two Google Play collisions (a grooming-booking app and a
  pet-record app) but is fully clear on Apple; its trademark registers are
  likewise all BLOCKED.

`Snoutly` (an identical name already trading in the exact same "AI pet
health" sector, plus a registered US word mark in pet goods) and
`Tailwise` (multiple active pet-care products, including one from a
company already trading as "Tailwise Solutions" in this space) show
materially higher collision risk and are **not** recorded as verified
fallbacks. This ranking is this document's own reading of the dossier
evidence above, not itself a new fact — a human reviewing §3.2-§3.5 could
reasonably weigh it differently, and none of the four should be treated as
clear without the counsel-level searches in §2's BLOCKED list.

---

## 4. **Risk** assessments

### R1 — "Bombay"/pet-sector collision

App-store searches (§3.1) found no app in any of the four storefronts
checked whose name pairs "Bombay" with a pet term, and the exact package
id `com.bombaypetcompany.app` is unused (HTTP 404). A dossier web-search
sweep for existing pet businesses named "Bombay" (pet shops, pet-care
brands, veterinary chains) surfaced none; Mumbai-area pet brands surfaced
instead were named differently (Pawsindia, Zigly, Supertails, PawPurrfect,
etc. — dossier §1.4, WebSearch, 2026-07-29 18:15-18:18 UTC, no primary
register or single stable URL, search-engine results only). Same-class
trademark registers (USPTO, EUIPO, India CGPDTM) could not be queried at
all (§2, BLOCKED); the only same-class signal available is secondary
(Trademarkia/Justia) and it surfaced unrelated-class "BOMBAY" marks
(apparel, furniture, spirits) — no pet-goods or pet-software "Bombay"
mark.

- Apple App Store: CONDITIONAL — no colliding app name found across
  US/IN/GB/DE, but the underlying same-class trademark registers were
  BLOCKED to automation, so registrability cannot be confirmed clear.
- Google Play: CONDITIONAL — same reasoning; the store-listing search is
  clean, the trademark-register question is open pending `[FOUNDER]`
  counsel search.

### R2 — Geographic-term risk ("Bombay")

`Bombay Pet Company` places a **geographic term** ("Bombay", a former name
of the city of Mumbai) at the front of the mark. This replaces the stale
task card's now-moot risk #2 (S2 — the old display name's `+`-handling;
the current name has no `+` and no special characters). The measured fact
recorded instead: `Bombay Pet Company` is **18 characters**, comfortably
under both stores' verified 30-character title cap (§5).

The statutory hooks a trademark lawyer would look at for a geographic term
(citations only, no legal conclusion drawn — see §3.1 for source URLs):

- US Lanham Act §2(e)(2)/§2(e)(3) — registration may be refused if a mark
  is "primarily geographically descriptive" or "primarily geographically
  deceptively misdescriptive" of the goods.
- EUTMR Art. 7(1)(b)/(c) — marks devoid of distinctive character, or
  consisting exclusively of a sign that may serve to designate geographical
  origin, may be refused.
- India Trade Marks Act 1999 §9(1)(b) — marks that serve exclusively to
  designate geographical origin may be refused, subject to a proviso for
  acquired distinctiveness through use.

Separately, the dossier's India-specific statutory checks (Emblems and
Names Act 1950 Schedule; MCA Companies (Incorporation) Rules city-name
position) could not be verified against primary sources (§2, items 6 and
8) — secondary summaries suggest no restriction specific to Indian city
names, but this is unconfirmed. The dossier also recorded, as a fact and
not a legal conclusion, that "Bombay" is an established cat-breed name
(CFA-registered since 1970, §3.1) — a fact relevant to a genericness/
descriptiveness argument (see R3) rather than to registrability of the
composite mark on its own.

Neither Apple's nor Google's own current app-metadata policy pages (as far
as fetched, §3.1/§6) state a restriction on a city name or the word
"Company" in an app title — so the geographic term is not a store-listing
blocker, only a trademark-registrability question.

#### Mitigation plan

If a geographic-descriptiveness refusal or a same-class conflict lands
during formal filing, the options below are ordered from least to most
disruptive. **Every option below is for `[FOUNDER]` decision at C3 —
none is executed by this task.** Switching the name **later than C3 is
far more expensive** than switching before it, because store records and
package ids are effectively immutable once published (an app cannot
silently change its package id/bundle id after release without becoming a
new listing that loses reviews, rankings, and install base).

1. **Proceed with the composite mark** and rely on the full composite
   (wordmark + logo) plus a build-up of acquired distinctiveness through
   use, rather than the bare geographic term alone. Repo impact: **none**
   — `APP_DISPLAY_NAME` in `packages/config`, the `bombaypetcompany` slug,
   `com.bombaypetcompany.app`, the `bombaypetcompany://` scheme, the
   S3/Redis/queue prefixes, the `bombaypetcompany@{version}+{updateId}`
   Sentry release format, and the `bombaypetcompany.app` domain all stay
   exactly as they are.
2. **Narrow the filing to classes 9 and 42 only** (downloadable software;
   SaaS), dropping class 35 if advertising/retail is not core to the
   business, to reduce the surface area of any same-class collision
   search. Repo impact: **none** — this is a filing-strategy choice, no
   identifier changes.
3. **Switch to a coined fallback** (`Nuzzo`, `Snoutly`, `Tailwise`, or
   `Pawnest` — see §3.2-§3.6; note none is collision-free either) **at
   C3, before any App Store Connect or Play Console record is created**.
   Repo impact if taken: `APP_DISPLAY_NAME` in `packages/config` changes
   to the new display name; the `bombaypetcompany` slug, the
   `com.bombaypetcompany.app` bundle id, the `bombaypetcompany://` deep
   link scheme, the S3/Redis/queue name prefixes, the Sentry release
   format (`bombaypetcompany@{version}+{updateId}`), and the
   `bombaypetcompany.app` domain would all need a coordinated rename —
   this is out of scope for T102 and would be its own task.
4. **Keep the display name but file a different, coined mark** as the
   registered trademark (e.g. a coined sub-brand used specifically on
   store listings and legal filings, while the product continues to
   present as `Bombay Pet Company` day-to-day) — a hybrid approach a
   trademark attorney may recommend where the descriptive/geographic
   composite is weak. Repo impact: potentially none if the coined mark is
   used only in legal/filing contexts and never rendered to users; if it
   were also adopted as the user-facing name, the same repo-impact list
   as option 3 applies.

- Apple App Store: CONDITIONAL — the store itself imposes no known
  restriction on this geographic term (§3.1/§6), but the underlying
  trademark-registrability question is unresolved (BLOCKED registers) and
  gates any confident long-term IP position.
- Google Play: CONDITIONAL — same reasoning as Apple App Store above.

### R3 — Descriptive/composite distinctiveness ("Pet Company" is generic)

The second half of the mark, "Pet Company", is a highly generic,
descriptive phrase for a company that makes pet-related products — it
does little to distinguish this app from any other "pet company" and
would carry little weight on its own in a distinctiveness analysis. This
is why the fallback candidates in §1 of the research brief were
deliberately chosen as coined/suggestive single-token names (`Nuzzo`,
`Snoutly`, `Tailwise`, `Pawnest`) rather than another descriptive
compound: a coined or suggestive mark is inherently stronger and cheaper
to defend than a descriptive one, and buys optionality if `Bombay Pet
Company`'s composite proves too weak to register comfortably. The
combination of a geographic term (R2) plus a generic descriptor
("Pet Company") compounds distinctiveness risk more than either half
alone — which is exactly the scenario the mitigation plan above (§4 R2)
is written to cover.

- Apple App Store: GO — a weak trademark position does not, by itself,
  block a store listing; App Review does not adjudicate trademark
  distinctiveness.
- Google Play: GO — same reasoning as Apple App Store above.

---

## 5. **Listing** pack

Character limits used, and which were verified against the stores' own
current documentation (§3.1/§6) versus assumed from secondary sources:

| Field | Limit used | Verified vs. assumed |
|---|---|---|
| Title | 30 | VERIFIED — Apple App Store Connect reference and Google Play Console policy both state 30 characters |
| Subtitle | 30 | VERIFIED — Apple App Store Connect reference states 30 characters (subtitle is an Apple-only field; Google Play has no equivalent subtitle field) |
| Keyword field (Apple only) | 100 | VERIFIED — Apple's product-page guide states "limited to 100 characters total" |
| Short description (Google Play) | 80 | VERIFIED — Google Play Console help states an "80 character limit" |
| Long description | 4000 | ASSUMED (secondary sources only) — neither Apple's nor Google's fetched primary pages stated a numeric description limit; secondary sources (splitmetrics.com, wordlimit.ai) report 4,000 characters for both stores, and that conventional value is used here per §2.5 of the research brief |

Character counts (independently counted by the executor, not trusted from
any illustrative source):

| Field | Characters | Limit |
|---|---|---|
| Title | 18 | 30 |
| Subtitle | 28 | 30 |
| Keywords | 96 | 100 |
| Short description | 73 | 80 |
| Long description | 1335 | 4000 |

<!-- listing:title:start -->
Bombay Pet Company
<!-- listing:title:end -->

<!-- listing:subtitle:start -->
Pet care guidance, not a vet
<!-- listing:subtitle:end -->

<!-- listing:keywords:start -->
pet,dog,cat,symptom,checker,pet care,reminders,vaccine,food safety,toxic,pet health,puppy,kitten
<!-- listing:keywords:end -->

<!-- listing:short-description:start -->
Calm pet-care guidance between vet visits. Not a substitute for your vet.
<!-- listing:short-description:end -->

<!-- listing:long-description:start -->
Bombay Pet Company is a calm companion for dog and cat owners, built to give you clear, practical guidance between vet visits.

Symptom guidance: describe what you are noticing and get organized possible causes, red flags to watch for, and clear next steps, so you know when a change is worth a call to your vet and when it is safe to keep an eye on things at home.

Food and toxin safety: quickly check whether a food, plant, or household item is safe for your dog or cat, with clear guidance to keep pets away from anything risky.

Care reminders: stay on top of vaccine appointments, parasite prevention, and scheduled medication refills so your pet's routine care never slips.

Health timeline: a simple, shareable record of your pet's weight, symptoms, and vet visits over time, so nothing gets lost between appointments.

Family sharing: invite household members so everyone stays on the same page about your pet's care.

Plus plan: unlock unlimited symptom checks, extra pets, and priority reminders with a low-cost subscription.

What this app is not: Bombay Pet Company offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian. This app is not a replacement for emergency veterinary care -- if your pet is in crisis, contact an emergency vet or poison-control hotline right away.
<!-- listing:long-description:end -->

---

## 6. **C3** decision flag

- [ ] **[FOUNDER]** Confirm or change the final display name `Bombay Pet Company`, the workspace/identifier slug `bombaypetcompany`, and the bundle id `com.bombaypetcompany.app` **before any App Store Connect or Play Console record is created** — package ids are effectively immutable after first publish. This decision is **provisional until C3** and requires trademark counsel sign-off before any filing or public listing.
- [ ] **[FOUNDER]** Approve or reject substitution **S1**: this screen researched the **India IP Office (CGPDTM)** register instead of the stale card's **Algeria INAPI**. If Algeria remains a launch market, that lookup is still owed and is not covered anywhere in this document.
- [ ] **[FOUNDER]** Approve substitution **S2**: risk #2 is now geographic-term registrability risk ("Bombay"), not the old name's `+`-handling risk, which is moot because the current display name has no `+`.
- [ ] **[FOUNDER]** Instruct qualified trademark counsel to run a real availability search and filing strategy in classes 9/35/42 (explicitly **not** class 44 veterinary services) before any trademark application is filed — nothing in this document is a clearance opinion.
- [ ] **[FOUNDER]** Determine who registered `bombaypetcompany.com` on 2026-07-19 (ten days before this screen; registrar NameCheap, Inc., registrant otherwise unknown to this automated screen). If it was not the founder, pursue a UDRP complaint or an alternative acquisition/negotiation path before relying on that domain.
- [ ] **[FOUNDER]** Register `bombaypetcompany.app` now — it is confirmed unregistered (RDAP HTTP 404) as of this screen, but domain availability can change at any time.
- [ ] **[FOUNDER]** Confirm `staging-api.bombaypetcompany.app` resolves before relying on it — it does not resolve today (NXDOMAIN), which `loop/checkpoint-C3-notes.md` §8 already treats as a hard blocker for internal distribution.
- [ ] **[FOUNDER]** If a coined fallback is preferred over `Bombay Pet Company`, choose between `Nuzzo` and `Pawnest` (the two verified fallbacks, §3.6) — or accept a fallback's own collision risk — strictly **before C3**, per the §4 R2 mitigation plan.

---

## 7. **Re-verification** procedure

This evidence is a snapshot from 2026-07-29 and goes stale. Before any
trademark filing or public store submission, a human (or a future
research pass) should re-run every query below and compare results
against §3 above.

**App store searches** (repeat for each candidate: `Bombay Pet Company`,
`Nuzzo`, `Snoutly`, `Tailwise`, `Pawnest`, plus `bombay pet` /
`bombaypetcompany` for the primary):
- Apple (machine-readable): `https://itunes.apple.com/search?term=<urlencoded>&entity=software&limit=50&country=<US|IN|GB|DE>`
- Apple (human-readable cross-check): `https://apps.apple.com/us/search?term=<urlencoded>`
- Google Play: `https://play.google.com/store/search?q=<urlencoded>&c=apps&hl=en&gl=<US|IN>`
- Package-id probe: `https://play.google.com/store/apps/details?id=com.bombaypetcompany.app`

**Trademark registers** (classes 9, 35, 42, and 44 as a negative check):
- USPTO: `https://tmsearch.uspto.gov/search/search-information`, TSDR at `https://tsdr.uspto.gov/` for any live hit
- EUIPO: `https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/<candidate>`
- India CGPDTM: `https://tmrsearch.ipindia.gov.in/tmrpublicsearch/`
- Algeria INAPI (still owed, S1): the register the stale card originally named — not substituted away by this document, only deferred

**Domains** (RDAP; HTTP 404 = unregistered):
- `https://rdap.org/domain/<name>.com` and `https://rdap.org/domain/<name>.app` for the primary and each fallback
- Host resolution: `https://dns.google/resolve?name=bombaypetcompany.app&type=A` and `...staging-api.bombaypetcompany.app&type=A`

**Store copy-limit re-check:**
- Apple: `https://developer.apple.com/help/app-store-connect/reference/app-information`, `https://developer.apple.com/app-store/product-page/`
- Google Play: `https://support.google.com/googleplay/android-developer/answer/9898842`, `https://support.google.com/googleplay/android-developer/answer/9866151`

Re-run these immediately before submission — this evidence is a snapshot,
not a standing state.

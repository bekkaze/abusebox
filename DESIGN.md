---
name: AbuseBox
description: Self-hosted threat monitoring for IPs and domains, where every result reads like a mail delivery report.
colors:
  paper: "#ffffff"
  rail: "#f3f4f6"
  sunk: "#f8f9fa"
  ink: "#14171c"
  ink-2: "#58606c"
  ink-3: "#8c939d"
  rule: "#e2e5ea"
  rule-strong: "#c8cdd4"
  accent: "#0d757f"
  accent-hover: "#095f68"
  accent-ink: "#ffffff"
  accent-soft: "#e6f4f5"
  s5: "#b42318"
  s5-soft: "#fef2f1"
  s4: "#9a5800"
  s4-soft: "#fff6e4"
  s2: "#1a7448"
  s2-soft: "#ecf7f0"
  info: "#345488"
  info-soft: "#eef2f9"
  scrim: "#0f1115"
  paper-dark: "#16191e"
  rail-dark: "#0f1115"
  sunk-dark: "#1c2026"
  ink-dark: "#e7eaee"
  ink-2-dark: "#9ea6b1"
  ink-3-dark: "#68707c"
  rule-dark: "#2d323a"
  rule-strong-dark: "#424954"
  accent-dark: "#48c4cc"
  accent-hover-dark: "#6ed6dc"
  accent-ink-dark: "#061618"
  accent-soft-dark: "#122e31"
  s5-dark: "#fa786e"
  s5-soft-dark: "#3c1a18"
  s4-dark: "#e8ac4c"
  s4-soft-dark: "#36270e"
  s2-dark: "#60cc91"
  s2-soft-dark: "#142e21"
  info-dark: "#92b0e2"
  info-soft-dark: "#1c2436"
  scrim-dark: "#000000"
typography:
  display:
    fontFamily: "Public Sans Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  status-code:
    fontFamily: "Commit Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1
  title:
    fontFamily: "Public Sans Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "Public Sans Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Public Sans Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  data:
    fontFamily: "Commit Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  field-name:
    fontFamily: "Commit Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.25rem
  label:
    fontFamily: "Public Sans Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1rem
  micro:
    fontFamily: "Public Sans Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1rem
    letterSpacing: "0.025em"
rounded:
  sm: "4px"
  md: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "40px"
  control: "36px"
  nav-row: "32px"
  bar: "56px"
  rail: "240px"
  aside: "272px"
  content-max: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.section-title}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.section-title}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "{spacing.control}"
  button-secondary-hover:
    backgroundColor: "{colors.sunk}"
  button-danger:
    backgroundColor: "{colors.s5}"
    textColor: "{colors.paper}"
    typography: "{typography.section-title}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "{spacing.control}"
  button-quiet:
    textColor: "{colors.ink-2}"
    typography: "{typography.section-title}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "{spacing.control}"
  button-quiet-hover:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "{spacing.control}"
  input-disabled:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink-2}"
  status-tag-listed:
    backgroundColor: "{colors.s5-soft}"
    textColor: "{colors.s5}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  status-tag-no-answer:
    backgroundColor: "{colors.s4-soft}"
    textColor: "{colors.s4}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  status-tag-requested:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  status-tag-clear:
    backgroundColor: "{colors.s2-soft}"
    textColor: "{colors.s2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  severity-tag-critical:
    backgroundColor: "{colors.s5}"
    textColor: "{colors.paper}"
    typography: "{typography.micro}"
    rounded: "{rounded.sm}"
    padding: "1px 6px"
  severity-tag-low:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink-2}"
    typography: "{typography.micro}"
    rounded: "{rounded.sm}"
    padding: "1px 6px"
  nav-item:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "{spacing.nav-row}"
  nav-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  surface:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  table-head:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink-2}"
    typography: "{typography.field-name}"
    padding: "8px 12px"
  table-cell:
    typography: "{typography.body}"
    padding: "8px 12px"
  alert-error:
    backgroundColor: "{colors.s5-soft}"
    textColor: "{colors.s5}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  alert-warning:
    backgroundColor: "{colors.s4-soft}"
    textColor: "{colors.s4}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: AbuseBox

## Overview

**Creative North Star: "The Delivery Report"**

AbuseBox reads like the mail its users run. Every result is laid out as a delivery report: a reply-class code (`5.x` listed, `4.x` no answer, `3.x` pending, `2.x` clear), a plain sentence saying what happened, then `Field-Name: value` rows in the manner of RFC 5322 headers, then a table with one row per list. The interface is white paper with near-black ink and hairline rules. Navigation sits on a cool grey rail. The only decorative colour is the logo's teal, and it marks the one action that matters on a screen. Red, amber and green carry status and never decorate.

Density is that of an operator's tool: 14px body text, 36px controls, 32px nav rows, and tables that show 20+ blacklist rows without paging. Hierarchy comes from type weight, the mono/sans split and hairline rules, not from boxes, tiles or colour fills. A page opens with its verdict line: a large mono status code beside a semibold sentence. Below that, regions are separated by a 1px rule under a small semibold title rather than wrapped in cards. The system refuses the KPI-tile SaaS dashboard: no big-number stat grids, no coloured icon tiles, no gradient buttons, no cards inside cards.

Both themes exist and share every token name. Light leads. Dark swaps the channel values under a `.dark` class on the root, lifts the status hues so they stay legible on near-black, and keeps a single paper-and-rail structure.

**Key Characteristics:**
- A verdict line first: mono reply-class code plus a sentence, coloured by severity.
- Header-style field rows with grey mono `Field-Name:` keys and ink values.
- Hairline-ruled sections instead of boxed cards, on one flat paper plane.
- Two typefaces with strict jobs: Public Sans for interface, Commit Mono for data.
- One teal accent; status colour always paired with a code or text label.
- Shadows only on things that float above the page (dialogs, palette, toasts) and on the active rail item.

## Colors

The palette is a restrained paper-and-ink neutral set, one teal accent, and three SMTP-style status hues (red, amber, green) plus a slate blue for "pending". Every token is defined as RGB channel triples in `frontend/src/index.css` (`--paper: 255 255 255`) and exposed to Tailwind with alpha support (`bg-s5/30`). The hex values in the frontmatter are the same colours. Each `-dark` key is the value that token takes under `.dark`.

### Primary
- **Logo Teal** (`accent`): the only accent. It fills the primary button, colours text links and "Request removal" actions, draws the focus outline (2px, offset 2px), marks the selected tab underline, the active rail icon, the switch "on" track, and the selected state of segmented filters and interval chips (`accent-soft` fill). 5.4:1 on paper. Hover deepens it to **Deep Teal** (`accent-hover`). In dark mode it brightens to a light cyan, and text on it (`accent-ink`) turns near-black.
- **Teal Wash** (`accent-soft`): the background for selected states only (selected segment, selected asset card, selected table row).

### Secondary (status classes)
- **Bounce Red** (`s5`, soft `s5-soft`): reply class `5.x`. Listed, critical, failed, destructive. Also the bar colour in blacklist-history charts and the fill of the one solid chip (Critical severity).
- **Deferral Amber** (`s4`, soft `s4-soft`): reply class `4.x`. No answer, warning, inconclusive. Also used for the default-password banner.
- **Accepted Green** (`s2`, soft `s2-soft`): reply class `2.x`. Clear, healthy, pass, resolved. Also the "API up" and "scheduler running" dots.

### Tertiary
- **Queue Slate** (`info`, soft `info-soft`): reply class `3.x`. Removal requested, pending, informational alerts and toasts.

### Neutral
- **Paper** (`paper`): the content plane, dialogs, inputs, secondary buttons, and the active rail item.
- **Rail Grey** (`rail`): the sidebar, the settings tab list and the landing footer. It sets navigation apart from content.
- **Sunk Grey** (`sunk`): table heads, the search trigger, code blocks, hover fill for rows and quiet buttons, disabled inputs.
- **Ink** (`ink`): primary text, values, hostnames. 18:1 on paper.
- **Field Grey** (`ink-2`): field names, secondary text, placeholders, table header labels, inactive nav. 6.3:1 on paper, 5.8:1 on rail.
- **Faint Grey** (`ink-3`): decorative only: chevrons, empty-state icons, "off" dots, em-dash placeholders. 3.1:1, so it never carries text a user must read.
- **Hairline** (`rule`): every divider, section underline, table row rule and surface border.
- **Firm Hairline** (`rule-strong`): input and secondary-button borders, hover border on cards, chart axes, the "off" switch track.
- **Scrim** (`scrim`): behind dialogs and the mobile drawer at 50%. Dark in both themes.

### Named Rules
**The One Teal Rule.** Teal is the only non-status colour. It marks what you can act on (primary button, links, focus, selection) and nothing else. No teal headings, no teal icons in content, no teal panels.

**The Reply Class Rule.** Status colour never appears without its code or label. `5.x`, `4.x`, `3.x`, `2.x` sit in mono beside the word (Listed, No answer, Removal requested, Clear), so meaning survives without colour. A coloured dot is allowed only next to a text state (Running, On, API up).

**The Soft-Fill Rule.** Status chips and alerts use the `-soft` background with full-strength text, never a solid status fill. The single exception is the Critical severity chip (solid `s5` on `paper`), which marks the worst case.

## Typography

**Display Font:** Public Sans Variable (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Public Sans Variable (same stack)
**Label/Mono Font:** Commit Mono 400 and 600 (with ui-monospace, SFMono-Regular, Menlo, monospace)

**Character:** Public Sans is a plain, government-issue grotesque that reads as a tool, not a brand. Commit Mono is the voice of the machine: everything a server would print (zones, hostnames, IPs, record values, reply codes, field names, timestamps) is set in it. Tabular figures are on globally (`font-feature-settings: 'tnum' 1`).

### Hierarchy
- **Display** (600, 2rem → 2.5rem at sm → 2.75rem at lg, line-height 1.12 → 1.08, tight tracking): the landing hero headline only, with `text-wrap: balance`.
- **Headline** (600, 1.5rem, tight): the dashboard verdict sentence and the 404 title. Landing section titles use 1.25rem → 1.5rem.
- **Status Code** (Commit Mono 600, line-height 1): the reply-class code that leads a verdict line. It is one step larger than the sentence beside it: 1.75rem next to the 1.5rem dashboard headline, 1.5rem next to the 1.25rem asset verdict, 1.125rem next to an 1.125rem result verdict.
- **Title** (600, 1.25rem, tight): page titles in `PageHeader`, followed by a 14px `ink-2` description capped at `max-w-prose` (65ch).
- **Section Title** (600, 0.875rem): the heading above a hairline in every `Section`. Buttons use the same size and weight.
- **Body** (400, 0.875rem, line-height 1.5): all running text, table cells, nav items. Medium (500) for form labels and inactive tabs.
- **Data** (Commit Mono 400, 13px): blacklist zones, hostnames and record values inside tables and lists. Hostnames that head a row (attention rows, asset cards) go to 14–15px semibold mono.
- **Field Name** (Commit Mono 400, 0.75rem, `ink-2`): the key in a field row, written Hyphenated-Title-Case with a trailing colon (`Last-Checked:`, `Due-Now:`, `AbuseIPDB-Score:`). Table header cells use the same style without the colon.
- **Label** (600, 0.75rem): status tags, inline reply codes (mono), helper and hint text (400).
- **Micro** (0.6875rem, line-height 1rem): the `2xs` step. Uppercase with wide tracking only inside the severity chip; normal case for `kbd` hints, check-type tags (BL, DNS, SSL) and the code inside a status tag.

### Named Rules
**The Machine Voice Rule.** If a server would print it, set it in Commit Mono: zones, hostnames, IPs, DNS and TXT values, reply codes, field names, relative timestamps in feeds, chart axis ticks. Sentences, labels, buttons and headings stay in Public Sans. Mono is never used for decoration or headings.

**The Field-Name Rule.** Key/value details are written as message headers: grey mono `Field-Name:` on the left, ink value on the right, in a two-column grid (`max-content` and `1fr`, 16px column gap, 6px row gap). Do not use bold labels, label-above-value stacks, or stat tiles for this.

**The No Eyebrow Rule.** Titles carry their own weight. No small uppercase kicker above a heading.

## Layout

The app is a two-pane shell: a 240px rail on the left (sticky at full height from `lg` 1024px, an off-canvas drawer below it that slides in over a 50% scrim in 200ms ease-out and closes on Escape), and a content column with a 56px sticky top bar (`paper` at 95% opacity with a small backdrop blur). The top bar holds the command-palette trigger (a `sunk` field with a `⌘K` hint, max 28rem), the API status dot and the theme toggle.

Content sits in a `main` capped at 72rem and centred, with 16px side padding and 20px top padding on mobile, 32px and 28px from `sm` (640px). Settings narrows itself to 64rem with forms capped at 42rem. The public landing and quick-check pages use the same 72rem column with 16px/24px gutters.

The dashboard follows its first-viewport contract: a verdict block (status line plus a one-line `Field: value` summary) closed by a hairline, then a two-column grid from `lg` with a flexible main column and a 272px aside, 40px column gap and 32px between stacked sections. Attention rows and the activity feed run on the left; Scheduler and Blacklist history run on the right. Below `lg` everything stacks in reading order.

Spacing is Tailwind's 4px base. Recurring steps: 4px (icon gaps), 8px (control gaps, cell padding block), 12px (cell padding inline, section-title to content), 16px (page-header bottom, field column gap), 24px (major block gaps), 32px (between sections), 40px (main/aside gap). Controls are 36px tall, nav and settings tabs 32px. Pages are a single column on phones. Tables keep their columns and scroll horizontally inside their bordered frame (the asset table has a 60rem minimum). Filter bars wrap.

**The Report Column Rule.** Pages read top-down like a report: verdict, summary fields, what needs action, detail. Do not place parallel tiles side by side to summarise state.

## Elevation & Depth

The system is flat. Depth comes from tone (rail grey behind paper, sunk grey for heads and insets) and 1px hairlines, not shadows. The page plane carries no shadow at all. Shadows appear in exactly two roles: on surfaces that float above the page (dialogs, the command palette, toasts, chart tooltips), and as a 1px lift on the active item of a grey tab list (the rail and the settings tabs), where it reads as a sheet of paper laid on the rail.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 12px 32px rgb(0 0 0 / 0.18)`): dialogs and the command palette, always with a `rule` border, `paper` fill and a scrim behind.
- **Paper Lift** (`box-shadow: 0 1px 2px rgb(20 23 28 / 0.06)` plus a 1px `rule` ring): the active rail link and the active settings tab.
- **Toast** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.12)`): react-toastify toasts, with a `rule` border.
- **Tooltip** (`box-shadow: 0 4px 12px rgb(0 0 0 / 0.08)`): the Recharts tooltip.

### Named Rules
**The Flat Page Rule.** Nothing that sits on the page casts a shadow: no shadowed cards, tables or panels. If it does not float above the page or sit selected on the rail, it is flat.

## Shapes

Corners are gently rounded and nearly uniform. **6px** (`rounded-md`) is the house radius for every control, surface, table frame, alert, dialog, nav item and toast. **4px** (`rounded`) is reserved for small inline marks: status and severity tags, check-type tags, `kbd` hints, code chips, skeleton bars and checkboxes. **Full** rounding is only for dots (status indicators, the timeline node) and the switch. The focus outline draws at 3px radius.

Borders are 1px hairlines. `rule` frames passive surfaces and divides rows and sections. `rule-strong` frames things you type into or press (inputs, secondary buttons, segmented groups). A 2px border appears in one place: the selected tab underline on the asset detail page, in teal. The activity feed is a 1px vertical `rule` line with 5px `rule-strong` nodes, drawn like a `Received:` header chain.

## Components

### Buttons
Compact, flat and squared-off, with no shadows and no gradients.
- **Shape:** gently rounded (6px), 36px tall, 14px inline padding, 14px semibold label, 8px gap to an 18px outline icon.
- **Primary:** teal fill with white text (`button-primary`). Use one per view, for the main action (Add asset, Re-check, Check, Save changes).
- **Secondary:** paper fill, ink text, `rule-strong` border. Hover fills `sunk`. Used for Edit, Import, CSV, the refresh button and the scheduler run button.
- **Danger:** solid `s5` fill with paper text, for confirming a destructive action inside a dialog.
- **Quiet:** no fill or border. `ink-2` text turns ink on hover over a `sunk` fill. Used for Cancel and tertiary actions.
- **Hover / Focus:** a colour transition only (Tailwind's 150ms default). Keyboard focus is the global 2px teal outline offset 2px. Disabled is 50% opacity with a not-allowed cursor.
- **Inline links:** teal, medium weight, underline on hover with a 2px offset (`linkClass`).

### Chips
- **Status tag** (`StatusTag`, `SeverityBadge`): a soft status fill with full-strength text, 4px radius, 12px semibold label, preceded by its mono reply code at 11px and 80% opacity. Four states: Listed `5.x`, No answer `4.x`, Removal requested `3.x`, Clear `2.x`.
- **Severity tag** (`SeverityTag`): 11px uppercase semibold with wide tracking. Critical is solid red, High soft red, Medium soft amber, Low `sunk` with a `rule` ring, Info soft slate. It sits before the plain-language listing reason.
- **Check-type tag:** 11px mono `ink-2` with a `rule` ring and 4px radius (BL, DNS, SSL, DMARC, UP).
- **Segmented filter / interval chips:** a `rule-strong` framed group of 36px segments. The selected segment takes `accent-soft` with teal text; unselected segments are `ink-2` and fill `sunk` on hover. Counts sit inside in 11px mono.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** `paper`. A selected card turns `accent-soft` with a 40% teal border.
- **Shadow Strategy:** none (see The Flat Page Rule).
- **Border:** 1px `rule`, hardening to `rule-strong` on hover.
- **Internal Padding:** 16px for asset cards, 8px × 12px for info tiles. The default container is not a card at all: a `Section` is a 14px semibold title over a 1px `rule` with 12px below. Bordered frames are kept for tables, asset cards in grid view, code blocks and dialogs.

### Inputs / Fields
- **Style:** 36px tall, `paper` fill, 1px `rule-strong` border, 6px radius, 12px inline padding, 14px text, `ink-2` placeholder. Inputs that take domains, IPs, selectors or lists switch to mono.
- **Focus:** the border turns teal and a 2px teal ring at 25% appears. The global outline is suppressed on inputs.
- **Error / Disabled:** `aria-invalid` turns the border red, with a red message below (`role="alert"`). Disabled fills `sunk` with `ink-2` text.
- **Labels and help:** a 14px medium ink label 6px above; 12px `ink-2` hint text 6px below.
- **Switch:** 36 × 20px pill, teal when on and `rule-strong` when off, with a paper knob.

### Navigation
- **Rail:** `rail` background, 1px `rule` right border. The logo (28px, 6px radius) sits beside a 15px semibold "AbuseBox" wordmark in a 56px row. Groups ("Monitor", "Check & lookup") have a 12px medium `ink-2` sentence-case label. Items are 32px rows with a 17px outline icon and 14px text in `ink-2`, turning ink over 70% paper on hover. The active item is a paper sheet with ink semibold text, a teal icon, a `rule` ring and the Paper Lift shadow. Footer links (API docs, Sign out) sit below a hairline. Sign out turns red on hover.
- **Tabs (asset detail):** text tabs on a hairline, 24px apart. The selected tab is ink semibold with a 2px teal underline; the others are `ink-2` medium and show a `rule-strong` underline on hover. Full keyboard roving with the arrow keys.
- **Tabs (settings):** the rail pattern in miniature: a `rail` box with 4px padding, vertical from `lg` and horizontal-scrolling below.
- **Mobile:** a hamburger in the top bar opens the rail as a drawer. The landing navbar collapses to a menu with 40px rows.

### Verdict Line (signature)
The first thing on every result: a mono reply-class code in the severity colour, then a semibold ink sentence that says what is wrong in plain words ("2 assets need action", "Listed on 22 of 24 blacklists"). A secondary line may follow in 14px `ink-2` with its own inline `4.x` code ("2 did not answer, so their result is unknown, not clean."). The dashboard adds a single summary line of `Field: value` pairs, 24px apart, under it.

### Field Rows (signature)
`Fields` / `Field`: a definition list rendered as message headers. The key is mono 12px `ink-2` with a trailing colon; the value is 14px ink and breaks long strings. A missing value shows an em dash. Used for scheduler state, asset metadata, AbuseIPDB details, record breakdowns and the landing feature list.

### Provider Table (signature)
One row per blacklist inside a 6px `rule` frame, scrolling at 70vh with a sticky `sunk` head. Head cells are mono 12px `ink-2` (List, Status, Reason). The zone is 13px mono ink, the status is a status tag, and the reason is a severity tag plus a plain-language explanation. The row action ("Request removal") is a right-aligned teal text link. Rows are divided by `rule` and take `sunk` at 60% on hover. Listed rows sort first.

### Attention Row and Event Feed
- **Attention row** (`IssueRow`): a 36px code column (mono 12px semibold reply code), then the hostname in 14px semibold mono and each issue as a 14px `ink-2` line. The whole row links to the asset and shows a `sunk` hover fill and a faint chevron.
- **Event feed** (`EventList`): a vertical hairline with dots. Each event has a 12px meta line (reply code, mono relative time, mono hostname link), a 14px ink title (semibold when critical) and an optional 12px `ink-2` detail.

### Alerts, Empty and Loading States
- **Alert:** 6px radius, soft status fill, a 30% status-colour border, 10px × 14px padding. Error, warning and info tones.
- **Banner:** the default-password warning is a full-width amber strip under the top bar with a bottom border, an icon, an underlined action and a dismiss button.
- **Empty state:** left-aligned, max 28rem: a faint 24px icon, a semibold title, a 14px `ink-2` sentence that says what to do next, and one primary action.
- **Skeleton:** `rule` at 70% bars, 4px radius, with a pulse, shaped like the content they replace.

## Do's and Don'ts

### Do:
- **Do** open every result with a Verdict Line: mono reply-class code in its status colour, then a sentence that says what is wrong and how much.
- **Do** write details as `Field-Name: value` rows with mono `ink-2` keys (Hyphenated-Title-Case, trailing colon).
- **Do** separate regions with a 14px semibold title over a 1px `rule`, and keep the page on one flat paper plane.
- **Do** set zones, hostnames, IPs, record values, codes and field names in Commit Mono, and everything else in Public Sans.
- **Do** pair every status colour with its code or word (`5.x Listed`, `4.x No answer`). Show "No answer", never "Clear", when a list did not respond.
- **Do** keep teal for the primary action, links, focus and selection. Use one primary button per view.
- **Do** use 6px radius for controls and surfaces and 4px for inline tags, and keep controls 36px tall.
- **Do** define every colour through the semantic tokens (`paper`, `ink-2`, `s5-soft`...) so light and dark both work. Raw Tailwind palette colours do not appear anywhere in the build.

### Don't:
- **Don't** build KPI tiles, big-number stat grids or coloured icon tiles to summarise state. The status line and a summary field row do that job.
- **Don't** wrap sections in shadowed cards, or put cards inside cards.
- **Don't** use gradients, glows or coloured shadows on any surface or button.
- **Don't** use teal for headings, decoration or content icons, and don't introduce a second accent hue.
- **Don't** fill a status chip with solid colour except Critical severity.
- **Don't** put an uppercase eyebrow or kicker above a heading.
- **Don't** set `ink-3` text that a user must read. It is for chevrons, dots and placeholder dashes only.
- **Don't** add a shadow to anything that sits on the page. Only dialogs, the palette, toasts, tooltips and the active rail item cast one.

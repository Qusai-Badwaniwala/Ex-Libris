Ex Libris
Design Brief
For Claude Design
Version 1.0
Owner: the visual system and every screen.
Companion document: EX-LIBRIS-ENGINE-BRIEF.md, owned by Claude Code.
Finishing a book earns a green tick, never a strikethrough. Every other tracker greys out your finished shelf. That shelf is the point of this app and it should look like the best part of it.

Contents


Right-click and choose "Update field" to populate.

0 · Read this first
Before you design anything, do these four things, in order:
Read this entire document. Everything I could pin down is pinned down, so you spend your effort on design rather than on guessing intent. Where a decision is genuinely yours, I say so explicitly.
Inventory your tooling. Check available skills, plugins and MCP servers before Phase 0. Read the frontend-design skill if it is available to you — it is directly relevant, and section 3.6 of this brief responds to a specific warning in it. Say what you found in your first message.
Ask your questions. Section 12 has a starting list. Ask those and anything else. Wait for answers. Do not begin Phase 0 until the user has replied.
Set up the handoff files (section 11) before any design work.

How to communicate
Standard technical English. Plain words. Say only what is necessary.
No preamble. No summarising what you just did unless asked.
No unsolicited insights, observations, or commentary.
No restating the user&apos;s request back to them.
When presenting work, show it and note anything unresolved. Nothing else.
Ask questions whenever you have them. A question is never wasted; a wrong assumption always is.
When a decision is needed, give two or three concrete options with a recommendation, not an open question.

Verbose output costs the user tokens and attention.

The user is the client and the sole audience. They are not a designer by trade but they have specific, well-formed taste, and they have already rejected the obvious version of several of these ideas. Show work as concrete options with a recommendation, not as open-ended questions. When you disagree with something here, say so with a reason — this brief is a starting position, not scripture.
1 · What you are designing
Ex Libris is a personal reading tracker. A mobile-first PWA. Single user. Fully offline. No accounts, no cloud, no social features, no notifications, no cost.
The user reads books (published, complete on arrival), novels (web and light novels, serialized over years, sometimes thousands of chapters, sometimes abandoned by their author), and manhwa. They read dark, dense, intricately-constructed fiction — the kind with ruthless protagonists and rigorous magic systems.
The name is the design brief
Ex libris — "from the books of ___" — is what is printed on a bookplate: the small illustrated label pasted inside a book&apos;s front cover to mark whose it is.
That is the whole product. A private archive, not a productivity app. Quiet, warm, unhurried. It never nags, never gamifies, never celebrates with confetti. It remembers what the user has read and shows it back to them with a little dignity.
One line matters more than any other in this brief:
Finishing a book earns a green tick, never a strikethrough. Every other tracker greys out your finished shelf. That shelf is the point of this app and it should look like the best part of it.
If a design decision is ever ambiguous, resolve it toward that sentence.
What it must never feel like
A productivity app. A social network. A reading challenge. A gamified habit tracker. A bookshop. A skeuomorphic wooden bookshelf with 3D book objects and drop shadows — this is the single most likely failure mode and it would undo everything else.
2 · Your domain, and the boundary
You own
Palette, typography, spacing, motion, illustration. Every screen&apos;s layout and composition. Every component&apos;s appearance and states. Every transition. All user-facing copy — labels, buttons, empty states, errors, confirmations, the lot.
Claude Code owns
The data model, storage, the search corpus, all business logic, all API work, backup and restore, performance. They also implement what you specify.
The boundary rule
Do not decide data structure. If a screen needs a field, a state, or a computed value that SCHEMA.md does not contain, stop and ask — do not design around an invented field, because it will not exist. Equally, if Claude Code proposes a UI change for technical reasons, they are required to explain the reason and preserve your intent; hold them to that.
The shared contract
SCHEMA.md — Claude Code writes it, you read it. Every entity and every state a screen might need to render. Read it before designing any screen.
tokens.css and COMPONENTS.md — you write them, Claude Code consumes them. They are forbidden from hardcoding a colour, size, radius or duration. Make the token set complete enough that they never need to.
Your prototype files — HTML, CSS, and any JS or JSON. See below.
What you produce, and what happens to it
You produce static prototypes: HTML and CSS, plus JS or JSON where a screen needs interaction or sample data. You are not building the application. Claude Code ports your prototypes into React and assembles the real thing.
Two consequences you must design around:
One · Write markup they can port. Semantic HTML, clear class names, CSS custom properties from tokens.css rather than literal values, and structure that maps cleanly onto components. Comment anything non-obvious — especially spacing or animation values that look arbitrary but are not. A prototype that only works as one monolithic file is harder to port than the same design split by screen.
Two · They are instructed not to change your work silently. Claude Code has been told to port faithfully, never to clean up or reorganise your CSS, never to substitute a component library for something you hand-built, and to flag any deviation with a specific technical reason before proceeding. Hold them to that. If you see built output that diverges from your prototype and nobody told you, say so.
Your JSON is a specification of the shape a screen expects, not content to keep. Make that obvious — use placeholder titles rather than anything that could be mistaken for real data.
You go first, and you go all the way
There is exactly one handover in this project, and it happens when you are finished.
You are not blocked by anything. SCHEMA.md is attached to this brief — the complete data contract, written in advance precisely so you never wait on the engine session. Every field, every state, and every returned payload a screen could need is already defined there. Read it before designing any screen.
Work through all nine phases. When you are done, the user hands your complete output to Claude Code in a single package, and Claude Code builds the entire application against a finished design.
What this costs you: you will not see your work running in a real app until the very end. Compensate by prototyping in the browser as you go — your HTML should actually run, not just look right in a mockup. The cover transition and the axis scale in particular must be tested with a real thumb on a real phone before you call them done.
What this buys everyone: no context-switching, no half-designed screens waiting on data, and no engine rework when a design changes.
The one package you deliver
tokens.css — the complete token set
COMPONENTS.md — every component: anatomy, states, spacing, motion, tokens consumed
All screen prototypes — working HTML and CSS
Any JS or JSON showing interaction and expected data shape
All illustration SVGs
MOTION.md — spring curves, durations, transition choreography, haptic points
DECISIONS.md — so Claude Code understands intent, not just output

The only thing that would send work back to you afterwards is Claude Code finding something genuinely unbuildable. Section 3.7 exists to make that unlikely.
3.7 Technical constraints — read before designing
This is a PWA running in a mobile browser. Design freely within these limits; anything outside them will come back to you as rework.
Available and encouraged
View Transitions API — shared-element transitions between screens. This is what makes the cover transition possible.
CSS linear() easing — can encode real spring curves. Use it instead of ease-in-out.
Vibration API — short haptic ticks on Android. Crude compared to iOS Taptic Engine: you get duration, not texture. Design for a 10ms tick, nothing more expressive.
Self-hosted variable fonts — any font you like, as long as it is free to embed.
CSS transforms, opacity, clip-path, masks, SVG animation — all fine and all GPU-friendly.
Dominant colour per cover, precomputed and cached. Available as a hex on every work.
Avoid or use sparingly
backdrop-filter and heavy blur — expensive on mid-range Android. Permitted on the nav shell only, nowhere else.
Animating anything other than transform and opacity — layout-triggering animation will drop frames.
Designs that require measuring every item in a list — libraries up to 2,000 works are virtualised, so only the visible rows exist in the DOM. Masonry layouts and "tallest card sets the row height" patterns are problematic. Spine view in particular must work with virtualisation.
Screens that need every cover loaded at once — covers lazy-load. Design a graceful loading state rather than assuming a full grid.
Not available
Push notifications — and the app should not have them anyway.
iOS-grade haptics. Android vibration only.
Any server-rendered content. Everything is client-side.
Live data of any kind — no "currently reading with 12 others," no online status, no social layer.
Data reality
Catalogue data is full of holes. Every screen needs a sensible state for: no cover, no author, no series, no chapter count, no publication status, and a manually-entered work with almost nothing but a title. These are not edge cases — for web novels they are the common case. A design that only looks right with complete metadata is not finished.

If you want something outside these limits, ask the user before designing around it. It is much cheaper to check now than to redesign later.
3 · The visual system
Most of this is decided. Where it is open, I mark it [your call].
3.1 Palette
The user chose "coffee." The premium expression of that is temperature, not hue: warm-tinted neutrals rather than brown chrome. The palette was then deliberately enriched along three axes — more neutral steps, one cool counterweight, and a genre spectrum.
The principle that keeps it premium: every colour has a job. Colour that encodes something makes the app richer; colour that merely exists makes it cheaper. And every hue below sits in the same saturation and lightness band — that discipline is what separates a rich palette from a noisy one.
31 tokens. 19 are chrome. 12 appear only on genre chips.
Surfaces — four planes, not two
Token
Dark

Light

Use
--surface-sunken
#100E0B

#EFEAE1

Inputs, wells
--surface-base
#16130F

#F7F3EC

Page
--surface-raised
#1F1B16

#FDFBF7

Cards
--surface-overlay
#29241D

#FFFFFF

Sheets, menus

Four planes let a sheet over a card over a page read as three distinct depths without a single drop shadow.
Text — four tiers
Token
Dark

Light

Use
--text-primary
#F5F0E8

#1C1814

Titles, body
--text-secondary
#A89F92

#6B6358

Metadata
--text-muted
#6B6358

#9A9086

Hints, placeholders
--text-faint
#4A443C

#B5ADA2

Disabled, dividers with text

Hairlines
--hairline — 10% of text-primary. Default dividers and borders.
--hairline-strong — 18% of text-primary. Emphasis, focused inputs, active states.
Always 0.5px. Never a flat grey.
Accent — four depths of coffee
Token
Dark

Light

Use
--accent-deep
#4A3520

#3A2818

Espresso. Fills behind accent text
--accent-muted
#8F5C24

#7A4A18

Roast. Pressed states, borders
--accent
#C8873F

#A8641F

Crema. The primary accent
--accent-bright
#E0A45C

#C8873F

Foam. Hover, highlights
Cool counterweight
One desaturated slate against all that warmth. This is the oldest trick in warm-palette design: a single cool note makes every warm colour read warmer by contrast. Without it the app risks reading monotone.
Token
Dark

Light

Use
--cool
#7A93A6

#4A6376

Informational states, publication badges, links, selection

Slate rather than teal, deliberately — teal sits too close to the finished-green and the two would compete.
Status
Token
Value

Meaning
--status-reading
#C8873F

Reading, and Caught up
--status-finished
#6B8F5E

Finished
--status-dropped
#8A7F76

Dropped
--status-wishlist
#7E6A52

Wishlist

Identical in both themes. Caught up shares Reading&apos;s colour but is differentiated by treatment rather than hue — a dashed or segmented progress track. [your call] on the exact device.
Genre spectrum — twelve hues
These appear on tag and genre chips and nowhere else. Twelve muted hues pinned to the same saturation and lightness band, so any combination that lands on a card harmonises. This is where richness earns its keep — tags are categorical data that needs distinguishing at a glance, and a wall of identical grey chips is useless.
Name
Hex

Name
Hex

Clay
#B5705A

Slate
#5A7184

Amber
#C8873F

Indigo
#6A6B96

Ochre
#A8904A

Plum
#9C5A72

Moss
#6B8F5E

Rose
#B0707A

Jade
#4F8A73

Umber
#8A6A50

Teal
#4E7A82

Stone
#7E7A72


Assignment is stable — a genre keeps its colour permanently once assigned. [your call] on whether assignment is manual, hashed from the tag name, or drawn from a curated map for common genres with hashing as fallback. A hash is simplest; a curated map for the twenty most common genres would read as more considered.

Both themes must be genuinely strong; this is not a dark app with a light afterthought. One asymmetry to solve: in light mode, covers need a hairline or subtle inset to stop them floating; in dark mode they separate on their own.
The rule that survives all this enrichment: chrome stays quiet so that book covers are still the most saturated thing on screen. Thirty-one tokens is a system, not a licence. Most screens should use six or seven of them.
3.2 Typography
Two families, deliberately unalike.
Display — a serif with real character. Proposals: Fraunces (variable, with optical-size and "wonk" axes — genuinely characterful), Newsreader, or Instrument Serif. [your call], but pick one with a point of view; a neutral serif wastes the opportunity.
Interface — Inter, or [your call] on an alternative with proper tabular figures.

Suggested scale — adjust if your chosen face wants different:
Role
Size / line height
Notes
Display L
40 / 44
Bookplate, year headings
Display M
30 / 34
Screen titles, book titles on detail
Display S
22 / 28
Section headings, series names
Body L
17 / 26
Notes, descriptions
Body
15 / 22
Default interface
Caption
13 / 18
Metadata
Label
11 / 14
Smallest permitted

Tabular figures everywhere numbers change — progress counts, stats, chapter numbers. A number that shifts width as it ticks is one of the loudest cheap-app tells.
Sentence case throughout. Never Title Case.
3.3 Spacing, radius, hairlines
Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 40 · 64. Nothing off-grid, ever.
Radius: 4 chips and small controls · 8 buttons and inputs · 12 cards · 16 sheets and modals · 999 pills. Different radii for different hierarchy levels — one radius on everything is a tell.
Borders are 0.5px at low opacity, not 1px grey. Depth comes from surface contrast and hairlines, not drop shadows. Shadows are permitted only on genuinely floating elements: the FAB and modal sheets.
3.4 Motion
Token
Duration
Use
--dur-fast
120ms
Taps, toggles, ticks
--dur-base
180ms
Sheets, expansion
--dur-slow
240ms
Screen transitions

Nothing exceeds 250ms.
Springs, not ease-in-out. Apple&apos;s motion feel comes from spring physics with damping — a slight overshoot and settle. CSS linear() easing can encode a real spring curve; use it. This is most of why Google Keep&apos;s FAB feels the way it does, and the user cited that specifically.
The signature moment: shared-element cover transitions. Tap a cover in the library and that exact cover flies and becomes the header of the detail page. Not a fade, not a slide — continuity of a physical object. The View Transitions API makes this achievable in a PWA. This is the single most premium move available here. Get it right and the app will feel more expensive than most things in an app store. Spend your effort here before anywhere else.
Restraint. Motion answers actions. No entrance animations on scroll, no hover transitions on every card, no ambient movement. One orchestrated moment beats scattered effects. Honour prefers-reduced-motion completely.
Haptics. The Vibration API works in Android PWAs. A ~10ms tick on: marking a book finished, each stop as an axis scale passes a position, and the FAB opening. Nothing else. Specify these; Claude Code implements them.
3.5 Illustration — original, hand-drawn, disciplined
The user wants original character drawings and doodles. Yes — but scattered illustration is exactly how a premium app turns cute. Three rules:
One · Illustration appears only where content does not. Empty library, empty wishlist, empty notes, empty trash, no search results, the finish moment, the bookplate. Never decorating a screen that already has books on it. Never behind text. Never in the chrome.
Two · One hand, one line weight, one ink. Monoline, no shading, no fills, drawn in the crema accent or the warm ink. This is what separates a book&apos;s own illustrations from mascot art. The reference is printer&apos;s ornaments, engraved frontispieces, the small marks in the margins of a Folio Society edition — not friendly blobs.
Three · Any recurring figure stays quiet. Five to eight appearances across the entire app. Never speaks. Never reacts to the user. A figure in the margin, not a companion.
Given what this user reads, steer away from the bookshop cat. A cloaked reader seen from behind, a crow, or a pair of hands — holding a book, turning a page, marking a place — sit right against dark fiction. [your call] on which, and propose a couple before committing.
The bookplate is where illustration is most elaborate — an engraved-style frame, the words Ex Libris, and the owner&apos;s name. Everything else is a single small figure. All of it as SVG line art you draw directly.
3.6 A specific warning about this palette
The frontend-design skill flags a current AI-design cliché: warm cream background near #F4F1EA, high-contrast serif display, terracotta accent near #D97757. This palette sits close to that neighbourhood, and the resemblance is a real risk.
Keep the palette — it is the client&apos;s explicit choice and it is right for a library. But differentiate deliberately:
Dark is the primary theme, and dark warm-neutral is not the cliché. Design dark first.
The accent is golden-amber crema (#C8873F), not clay-terracotta. Do not let it drift red.
Covers carry all the colour. The cliché is a page where the accent is the visual interest. Here the accent is nearly invisible — used perhaps three times per screen — because the content is doing that work.
Avoid the accompanying template chrome: tracked-out all-caps eyebrow labels above every heading, meta strings joined with middle dots, arrows appended to button text, identical rounded cards with identical soft shadows. Some of my own notation in this document uses those patterns; treat them as shorthand for me, not as specification for you.

If a screen you have designed could be lifted into an unrelated product without anyone noticing, it is not finished.
4 · Structure
Bottom navigation — four tabs: Library · Wishlist · Stats · Settings.
FAB floats above the bar at bottom-right, not centred, so it never contests a thumb position with a tab.
Left drawer: Notes · Trash · Backup & restore · About.
The FAB is explicitly modelled on Google Keep&apos;s — the user named it as the thing they love. Study what makes it work: the springiness, the way it expands rather than navigates, the restraint of it.
The three shelves
Books · Novels · Manhwa. The distinction is serialized versus published-as-a-unit: novels and manhwa arrive in chapters over time; books arrive complete.
The shelf is decided by how the user reads it, not by what a thing technically is. A web novel with a print edition is a Novel if they read it serialized. One tap to move it between shelves. The interface must never argue about taxonomy.
Shelves versus lenses
Only status is a real shelf. Everything else is a lens over the same set. The user never files anything.
Status — exclusive, mostly automatic: Wishlist · Reading · Caught up · Finished · Dropped
Series — automatic. Works in the same series collapse into one expandable stacked card.
Format — automatic, the three shelves.
Tags and genres — suggested from metadata, user-confirmable.
Custom shelves — manual, rare, for the thing that fits nowhere.

Caught up is not Finished. It exists only for ongoing works, and it means the user has read everything published so far. The distinction must be legible at a glance — the app should never claim someone finished something that has not ended.
5 · Screens
SCHEMA.md is attached to this brief. Read it before designing any of these — it defines every field and every returned payload, including the search, suggestion, recommendation and spine shapes.
#
Screen
What it must do
1
Bookplate
First run. Full screen, illustrated frame, the words Ex Libris, one field for the owner&apos;s name. The only time the app asks for anything personal. Becomes the About screen forever after.
2
Home / Library
Top to bottom: a Continue strip (1–3 in-progress covers, large, with progress) — because "what am I reading" is the 80% case and must not be two taps deep. Then the three format doors. Then three statistics. Search sits at the top.
3
Format screen
Books, Novels or Manhwa. A list: cover, title, tags, progress bar coloured by status. Collapsible sections — one per series, then standalones grouped by author. A view toggle to spine view. [your call] on whether sections default open or closed.
4
Book detail
The shared-element transition lands here. Cover as header, tinted by the cover&apos;s own dominant colour (Claude Code supplies the hex). Title, author, series with position, universe if any. Status and progress, both editable in one tap. The axis line. Stars. Tags. Notes. Publication status badge. More like this.
5
Add flow
FAB → search sheet → type → instant local results → tap → confirm. Results split into "In your library" and "Add to library". This is the most-used flow in the app and should be the most polished thing in it. Series and universe suggestions appear here as dismissible offers — never auto-applied.
6
Finish moment
Marking something finished. Green tick, haptic tick, then a single optional 15-second pass over the six axes. Never a nag — dismissible, returnable to later. Restraint here is the whole personality: a small, dignified acknowledgement, not a celebration.
7
Series page
All entries, ordered, with a completion ring. Entries not yet in the library shown as ghosts that can be added in a tap.
8
Universe page
Series within a continuity, plus any reading-order note. Rarer than series pages but it solves a stated frustration.
9
Spine view
See section 7 — it has its own failure mode.
10
Wishlist
Plus Surprise me, a random pick.
11
Stats
Finished this year, currently reading, library total, genre distribution, most-read author, series started versus completed, finish rate versus drop rate. Editorial, not dashboard — this is a page in a book, not a business intelligence panel.
12
Notes
Feed of all notes, pinned first. Notes may be free-floating or attached to one or more works.
13
Note editor
Body, optional title, tags, attach-to-work via the same search bar as everywhere else.
14
Settings
Theme, default views, backup status, export, import, corpus version and update, AI toggle (off by default), tag cleanup.
15
Backup & restore
Auto-backup status and history, manual export, and the three import paths: restore from backup, paste a list, CSV with column mapping.
16
Corpus download
First-run, honest progress, skippable, non-blocking. The app must be usable while it runs.
17
Trash
30-day retention, restore, empty.
18
Empty states — five
Library, wishlist, notes, trash, no-results. These are where the illustration lives and they are the first thing the user will ever see. An empty state is an invitation, not an apology. Never "Nothing here yet."
6 · The axes
The user&apos;s rating system. Six scales, each with five named stops. The names are the point — they make a book describable to another person in a way a number never could.
Axis
1
2
3
4
5
Protagonist
Heroic
Principled
Pragmatic
Ruthless
Monstrous
Power system
Vague
Loose
Coherent
Codified
Rigorous
World
Gentle
Fair
Harsh
Brutal
Merciless
Pacing
Slow burn
Patient
Steady
Driving
Relentless
Prose
Plain
Clean
Textured
Rich
Dense
Ending
Botched
Rushed
Passable
Satisfying
Earned
Translation
Rough
Stiff
Serviceable
Smooth
Fluent

Translation is shown only on translated works.
Rules that must hold in the design
Always show the word. Never show the number. No "3/5", no dots, no stars on these.
Scroll or drag between stops, with the word changing as it passes each one — one large word set in the display serif, swapping with a haptic tick per position. The user asked for this specifically. Done well it will feel expensive every single time.
Only Ending carries judgment. Plain prose is not worse than Dense; Slow burn is not worse than Relentless. Those are appetites. The visual treatment must not imply that 5 is better than 1 on the first five axes.
Ending is locked until a work is marked Finished, and carries a sixth state outside the scale: Unfinished — for works the author abandoned. Reverend Insanity does not have a botched ending; it has no ending. Different facts, different treatment.
Every axis is optional. Partial ratings are normal.

On the detail page, a book&apos;s profile reads as a line of type, set in the display serif — no radar chart, no bars:
Monstrous · Rigorous · Merciless · Driving · Dense
More editorial than any chart, and readable at a glance. [your call] on the separator; note the middle-dot warning in section 3.6 and consider alternatives.
More like this must explain itself — "matched on Monstrous and Merciless." Claude Code returns the matching axis names; surface them. A recommendation that cannot explain itself is not trustworthy.
7 · Spine view — the one with a trap
An alternate library view: books as spines on a shelf.
The failure mode is skeuomorphism. Wooden shelf textures, 3D perspective, drop-shadowed book objects, gradient leather. That reads as 2011 iBooks and would undo the entire visual system.
The version to build is flat and typographic:
Each spine is a solid vertical bar
Its colour is the cover&apos;s dominant colour (Claude Code supplies the hex)
Its width varies with length — a 2,300-chapter web novel gets a fat spine, a novella a thin one. Bucket into roughly five widths; [your call] on the buckets and the mapping
Title set vertically in the display serif
No texture, no shadow, no perspective

Colored bars of varying width on warm neutral — more beautiful and more honest than a fake bookshelf.
Lives as a toggle beside list view. It is most powerful on the Finished shelf, where a wall of spines becomes exactly the trophy case that greying-out destroys in every other app.
8 · Copy
You own every word. The voice: quiet, plain, warm, never cute.
Sentence case. Always.
Active voice. A button says what happens: "Add to library," not "Submit."
An action keeps its name through the whole flow. "Finish" produces "Finished."
No exclamation marks. No "please." No "successfully" — the confirmation is the success.
No first person. The app is not a character and never says "I."
Errors say what happened and what to do, in one sentence, without apologising.
Empty states are invitations. The headline names the space, one line explains it, the CTA is a verb.
Never congratulate. No "Great job!", no streaks, no encouragement. The user finished a book; they know.
9 · Quality floor
Not optional, and not announced: keyboard focus visible, prefers-reduced-motion honoured, contrast passing AA in both themes, touch targets 44px minimum, no text below 11px, safe-area insets respected, both themes verified on a real device rather than a simulator.
10 · Phase plan
Each phase ends with an updated HANDOFF.md and a checkpoint with the user. Do not roll into the next phase unprompted.
#
Phase
Delivers
Gate
0
Direction
Palette in both themes, type pairing chosen and justified, spacing and radius scale, motion tokens, tokens.css v1. Two or three illustration directions to choose from
User picks the illustration direction and signs off the type pairing before anything else
1
Core screens
Bookplate, Home, one format screen, book detail, add flow. The 80% of use
The five core screens run in a browser, not just as mockups
2
Signature motion
Shared-element cover transition, FAB behaviour, spring curves, haptic specification
The cover transition works on a real phone
3
The axes
Scroll-between-named-stops component, the finish moment, the axis line on detail
The scale feels good under a thumb, not just in a mockup
4
Series and universes
Stacked series cards, series page, universe page, completion rings, suggestion chips

5
Illustration
Bookplate frame, five empty states, the finish mark, any recurring figure. All SVG

6
Spine view
Per section 7
It does not look like a bookshelf
7
Secondary screens
Wishlist, Stats, Notes, note editor, Settings, backup and restore, import, corpus download, Trash

8
States and edges
Loading skeletons that match final layout exactly (never spinners), error states, long titles, missing covers, 2,000-item libraries

9
Critique
Full pass against section 3.6. Remove one accessory per screen

11 · Handoff protocol
Sessions will hit context limits. Update these at the end of every working session and after every significant decision.
HANDOFF.md — overwritten each session. Current phase; what was designed this session; what is in progress and where; the next three actions; anything unresolved. Write it for someone with no memory of the conversation, because that is who reads it.
DECISIONS.md — append-only, dated. Every design decision with its reasoning and what was rejected. Prevents re-litigating settled things.
OPEN-QUESTIONS.md — anything needing the user or Claude Code. Mark BLOCKING or NON-BLOCKING.
tokens.css — the contract with Claude Code. Complete enough that they never need to invent a value.
MOTION.md — spring curves, durations, transition choreography, haptic points. Claude Code cannot reverse-engineer timing from static files.
COMPONENTS.md — every component: anatomy, states (default, pressed, disabled, loading, empty, error), spacing, motion, and which tokens it consumes.
ILLUSTRATION-NOTES.md — the line-weight rule, the ink rule, every piece drawn, and where each appears. Keeps a later session from drawing in a different hand.

Start a session by reading HANDOFF.md and OPEN-QUESTIONS.md. End by updating both. If a session is running long, write the handoff before you run out of room.
12 · Ask before you start
Ask these, plus anything else. Wait for answers.
Show me three things you find premium — apps, book covers, print, anything. Taste is faster to transmit by example than by adjective, and it will save us both a phase.
The display serif. Fraunces, Newsreader, or Instrument Serif — I can mock the app&apos;s title and one book card in each. Worth 10 minutes?
The recurring figure — a cloaked reader from behind, a crow, or a pair of hands. Or none at all, with illustration only in frames and ornaments. Which direction?
Density. Do you want to see more books per screen, or more breathing room per book? This trades directly against "fewer pages but rich."
Which theme do you actually use? Design should lead with whichever you will live in.
The Continue strip — one large in-progress book, or up to three smaller? You said you mostly read one at a time, which argues for one, but I want to check.
Series sections — open or collapsed by default when you enter a format screen?
Anything in this document that looks wrong, or that you assumed was included and cannot find?
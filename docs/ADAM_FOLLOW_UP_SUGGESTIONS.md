# Adam smart follow-up suggestions

Owner spec, captured 2026-09-02. Not yet implemented.

## The principle

Adam should not only answer the user. Adam should help the user understand what
they can do next.

```
USER ASKS -> ADAM HELPS -> WOVO SHOWS SMART NEXT ACTIONS -> USER CLICKS ONE -> THE WORK CONTINUES
```

The customer must not have to become an expert prompt writer, or keep asking
themselves "what should I type next?".

## What it is

Contextual clickable follow-up actions directly beneath an Adam response —
after an answer, draft, plan, search result or generated asset. **2–4 of them**,
never a giant list, never static generic buttons.

They are generated from: what the user asked, what Adam just produced, the
current Project, Brand Brain, connected apps, current workflow, available
Assets, user permissions, and current task state.

## Worked examples

| Adam just did | Suggestions |
|---|---|
| Wrote a Facebook caption for a BBQ deal | Add the restaurant's location and hours · Make the deal sound more urgent · Make it funnier · Create a graphic for this |
| Created a video-ad concept | Turn this into a 15-second video · Make a cheaper version · Make it more cinematic · Create the Facebook caption too |
| Generated an image | Make another version · Turn this into a video · Add my logo · Create a social post with this |
| Wrote/generated a song | Make the chorus catchier · Change it to country-rock · Generate the full song · Use this song in a video |
| Found a project ("pull up my steak campaign") | Continue this campaign · Show me all its Assets · Create a new post from this · Open the content calendar |
| Researched leads | Draft outreach emails · Show only the best leads · Add these to a campaign · Research 25 more |
| Summarised an email thread | Draft a reply · Make the reply shorter · Schedule a follow-up · Find related emails |
| Analysed a spreadsheet | Show the biggest changes · Create a report · Find duplicate rows · Update the lead statuses |
| Showed today's meetings | Prepare me for the first meeting · Show tomorrow · Find open time this afternoon · Create my daily plan |
| Computer produced a campaign plan | Reduce the credit cost · Maximize quality · Change the content mix · Approve and start |

## Behaviour rules

- **Clicking acts as if the user sent that instruction.** Never make them copy
  and paste the suggestion.
- **Context-matched.** Caption -> caption improvements. Video -> video/edit/social
  actions. Project -> project actions. Email -> reply/follow-up actions. Never
  irrelevant suggestions.
- **Evolving.** Once "Make it funnier" has been used, stop offering it unless
  context makes it sensible again.
- **Generation-aware.** After an image, "Turn this into a video" must carry that
  specific Asset through as the reference. The user never re-uploads.
- **Project-aware.** A conversation inside a Project keeps that Project context.
- **Brand-aware.** Brand Brain enables "Add today's hours", "Include the
  website", "Add the logo to a graphic".
- **Credit-aware.** If a suggestion performs paid work, show the cost —
  `Turn this into a video · ~48 credits` — or quote before executing. Simple
  edits and navigation need no credit warning.
- **Approval is never bypassed.** A suggestion may start a workflow, but
  publishing, purchases, large spends, external messages and destructive
  operations still go through their approval screen.
- **Suggestions map to existing commands internally** (`/video` etc.) without the
  user needing to know them.
- **Escalation.** After one social post, "Make the whole week's content" can
  start Make My Week / WOVO Computer.

### Confidence — no fake suggestions

Never surface an action that cannot actually complete. If social publishing is
not configured, do **not** show "Publish to Instagram now". Show "Connect
Instagram" instead. If an app is not connected but would help, suggest
"Connect Gmail to continue" rather than pretending the action is available.

Suggestion categories: EDIT · CREATE · CONTINUE · SEARCH · PUBLISH · SCHEDULE ·
ANALYZE · OPTIMIZE · CONNECT · DOWNLOAD · FOLLOW UP.

## UI

Compact text actions or chips directly beneath the relevant response. Not one
giant card per suggestion. Desktop wraps inline. Mobile wraps cleanly, may
scroll horizontally, keeps touch targets large, never overflows, never uses tiny
hard-to-tap links.

### Response toolbar (distinct from suggestions)

A subtle toolbar on Adam responses where relevant: Copy · Edit · Retry · Save ·
Add to Project · Download · More.

### Editable outputs

Written content — captions, emails, scripts, lyrics, blog content, ad copy,
campaign plans — should be directly editable where practical, so the user can
then ask for "make this section shorter", "change the ending", "add the
address".

Longer term, highlighting part of an output offers: Ask for changes · Rewrite ·
Shorten · Expand · Change tone · Make funnier · Fix grammar · Custom
instruction. This is what makes WOVO feel like a working document rather than a
chat transcript.

## Why it matters

This is also the product-discovery system. Rather than needing to know
everything WOVO can do, the user is continuously shown the logical next step:

```
Write Caption -> Create Graphic -> Turn Graphic Into Video -> Make Platform Versions -> Schedule Campaign
```

They learn WOVO by using WOVO.

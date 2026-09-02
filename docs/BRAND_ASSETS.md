# WOVO Brand Assets / Social Media Kit

Owner spec, captured 2026-09-02. Not yet implemented.

**Not a disconnected mini-product.** It must run on the same Adam, Create, model
registry, WOVO Credits, Assets, Projects, Brand Brain, WOVO Computer and
generation infrastructure as everything else.

## The promise

A user says *"make me a logo"*, *"make me a PFP"*, *"make a Facebook cover"*,
*"make a YouTube banner"*, *"make all my social branding match"*, *"make my
whole brand kit"* — and WOVO handles model selection, dimensions, safe areas,
brand context, layout, text accuracy, platform adaptation, quality check, export
and asset storage. Beginners let Adam handle it; power users do it themselves.

## Asset types

Logos · profile pictures/PFPs · Facebook covers · YouTube banners · X headers ·
LinkedIn banners · social avatars · business profile images · channel art ·
website hero graphics · email header graphics · event banners · campaign
graphics · social media kits · full brand kits.

## Entry points

- **Natural language** — "make me a logo", "turn this logo into all the sizes I
  need", "create matching branding for all my social accounts".
- **Slash commands** — `/logo /pfp /profile /banner /facebook-banner
  /youtube-banner /x-banner /linkedin-banner /brand /brand-kit /social-kit`.
- **Guided home** — Logo · Profile Picture · Facebook Cover · YouTube Banner ·
  Social Media Kit · Full Brand Kit · Event Branding Kit · Custom.

## Logo generator

Inputs: business name, industry, style, colors, tagline, symbol idea, desired
feeling. Adam guides **style** (Modern, Vintage, Luxury, Fun, Western, Minimal,
Let Adam Choose) and **type** (Text Only, Icon + Text, Badge, Mascot, Monogram).

Outputs where supported: primary, secondary, icon/mark, horizontal, stacked,
square social, light-background, dark-background, transparent PNG.

## Two hard rules that shape the architecture

**Critical text must be correct.** Business names, taglines, URLs, phone
numbers, dates and offers must be spelled right. Image models mangle text, so
the pattern is: **generate the visual mark with the model, then render exact
typography with WOVO's own layout/compositing layer.** Never approve visibly
malformed AI-generated brand text.

**No blind stretching.** Never turn a square PFP into a YouTube banner by
scaling it. Adapt with crop, recomposition, outpainting/extension where useful,
layout changes, safe-area positioning and text repositioning.

Also: only offer SVG/vector download when the workflow genuinely produces a
vector. Do not pretend a raster image is a true vector file.

## Safe areas and platform specs

One **centralized platform spec registry** — never dimensions scattered through
UI components. Schema: platform · asset_type · width · height · aspect_ratio ·
safe_area · max_file_size · supported_formats · last_verified_at ·
source_reference · status.

Specs change. **Verify current official guidance before enabling a platform
format and store the verification date. Do not fabricate dimensions.**

Previews where practical: circular profile preview, Facebook cover preview,
YouTube desktop preview, YouTube mobile safe region, LinkedIn banner preview.
PFPs render as circles — keep face, logo and text inside the safe centre.

## Social media kit — the priority workflow

One visual direction, then matching primary logo, PFP, Facebook cover, YouTube
banner, X header, LinkedIn banner, Instagram-compatible avatar and optionally a
social post template.

**Approval flow — do not spend credits generating every format up front:**

1. Create brand direction
2. Show 2–4 concepts
3. User chooses one
4. Show the social kit plan
5. Show estimated credits
6. User approves
7. Generate platform-specific assets

**Full brand kit** adds: secondary logo, icon, colour palette, font
recommendations, brand style notes, social post template, basic brand
guidelines.

## Brand Brain integration

If Brand Brain already holds the business name, existing logo, colours, fonts,
website, slogan, industry, audience or tone — use them. Never make the customer
re-enter what WOVO already knows. Default colour control to brand colours, with
"Let Adam Choose" and "Custom" available.

After generation offer: Use as Primary Logo · Save to Brand Brain · Set as
Profile Image · Add to Project · Create Matching Social Kit. **Never replace an
approved logo without confirmation.** Keep versions (V1/V2/V3) and allow
comparison; preserve history.

## Working from existing assets

- **Fix my logo** — clean, modernise, simplify, alternate layouts, PFP version,
  transparent version, banner versions. Preserve recognisable identity unless a
  major redesign is requested.
- **Turn this into a banner** — reuse the source asset, apply platform
  dimensions, recompose, protect safe areas, reposition text, apply Brand Brain,
  show a preview.
- References allowed: existing logo, photo, mascot, product, old banner, colour
  inspiration, reference screenshot, authorized likeness, existing WOVO asset.

## Credits

Price from real work: image generation, number of concepts, premium model,
transparent-background processing, upscale, outpainting, platform adaptations,
Adam planning, quality review.

**Do not overcharge for deterministic work.** If producing a format only needs
crop, resize, text layout and compositing, it must not be priced like a full
premium generation.

## Quality

WOVO brand quality check: business-name spelling, tagline, URL, logo
readability, brand consistency, contrast, safe area, platform crop, visual
defects, text positioning. Brand Guardian additionally checks generated assets
against Brand Brain — correct name, approved logo, correct colours, correct
website, approved slogan, correct offer.

## Output and organisation

Every completed logo, PFP, banner and kit asset becomes a **persistent WOVO
Asset** that can be downloaded, edited, reused, added to a Project, saved to
Brand Brain or used in a campaign. Clear names: `Boot Stompin BBQ — Primary
Logo`, `… — Facebook Cover`. When several assets are generated, offer to create
a Project automatically (`Boot Stompin BBQ Brand Kit`).

Downloads: PNG, JPG, transparent PNG, all sizes; SVG only when legitimately
supported.

## Follow-up suggestions

- After a logo: make a profile picture from this · create a Facebook cover ·
  create a YouTube banner · make the whole social kit · save to Brand Brain
- After a PFP: create matching banners · make another version · add to my brand kit
- After a banner: make all social sizes · create matching PFP · create a launch post

## Kits

**Event branding kit** — Facebook event cover, feed graphic, story graphic,
profile graphic, YouTube thumbnail, ticket graphic, announcement visual,
reminder visual.

**Campaign branding kit** — campaign badge/logo, profile variant, Facebook
cover, YouTube banner, post graphics, story graphics, video end card, thumbnail.

**WOVO Computer** can propose brand assets inside a larger outcome — "launch my
new business" might propose logo, PFP, social kit, Brand Brain, website concept,
launch campaign and social posts, with plan and credits shown before generating.

## Research

Use Mobbin for logo generator UX, brand-kit onboarding, asset-generation flows,
social preview patterns, export/download patterns, brand management and media
resizing UX. Adapt patterns; never clone a design.

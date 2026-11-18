# Design: the visual system

Last updated: 18 Nov 2026

## 1. Feel
- Premium, soft, glowing, friendly. **Never scary or clinical.**
  - No point-cloud faces, no X-ray views, no organs drawn on faces.
- Real, pretty, smiling, clothed people.
- Phone-first. Big simple headlines. **One obvious Book button.**

## 2. Themes
Every colour is a CSS variable in `src/app/globals.css`. Tailwind names map to them.

| Token (Tailwind) | Pearl & blush (default) | Sand & gold |
| --- | --- | --- |
| `porcelain` page bg | `rgb(253 251 252)` | `rgb(251 248 243)` |
| `mist` soft panel | `rgb(246 239 243)` | `rgb(241 233 221)` |
| `ink` text | `rgb(31 26 36)` | `rgb(43 33 27)` |
| `graphite` muted text | `rgb(98 88 104)` | `rgb(107 93 82)` |
| `flora` accent (buttons, links) | NEA rose `#b0396b` | Champagne gold `#8a6424` |
| `--c-warm` glow | Blush `#e8a4b8` | Sand `#d8b28c` |
| `--grad-text` | Rose → plum → lilac | Gold → copper → terracotta |

- Pink in Pearl, gold in Sand. **Use the accent the same way everywhere**, including buttons.
- Data and charts use the colour-blind-safe palette in `components/viz`.

## 3. Type
- **Instrument Serif** for headlines (`font-display`), with italic accent words.
- **Inter** for everything you read or tap.
- Body text at least 15 px on phones. Labels at least 12 px.

## 4. Shape and space
- Radius: cards `rounded-3xl`, big panels `rounded-4xl` (2rem), buttons `rounded-full`.
- Container max 1240 px, padding 1.25 rem on phones and 2 rem from `md`.
- Soft frosted glass (`backdrop-blur`), soft shadows, light glows.

## 5. Components
- **Buttons:** `btn-primary` (filled accent), `btn-ghost`, `btn-light`. Tap height at least 44 px.
- **Navbar:** the dock. Icons with an expanding active label.
- **Cards:** an icon, a short title, one line of text, one action.
- **Prompts to join:** a soft card after a free tool: *"Create a free account to save this to your Skin Diary."* There are two buttons:
  - **Create free account**
  - **Not now**
- **Forms:** one column, big inputs, labels above, errors in plain words under the field.

## 6. Account and admin screens (new)
- **Sign-in:** a one-screen card with an email field and **Send my code**, then a 6-box code input with auto-advance. **Continue with Google / Apple** sits under a divider.
- **Under-18 screen:** friendly copy: *"You're under 18, so a parent needs to say yes first. Enter their email."*
- **Account settings:** profile, consents (with toggles), sign-in methods, **Download my data**, **Delete my account** (confirm twice).
- **Admin:** a calm, dense table layout in the same theme, with a sidebar on desktop and tabs on phones. No playful animation. Clear "Staff only" badge.

## 7. Motion
- framer-motion for soft fades and rises. GSAP and Lenis for smooth scroll.
- Respect `prefers-reduced-motion`: turn off parallax and loops.

## 8. Images and films
- Unsplash (by id in `content/media.ts`) + NEA's own photos. **No duplicates.**
- Films: 720p H.264, silent, play only when on screen, with captions.

## 9. Accessibility
- Contrast AA (4.5:1 text). Focus rings visible. Every image has `alt` text.
- Camera features always explain what happens and offer a no-camera path.

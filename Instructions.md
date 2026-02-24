# KnotVite Public RSVP Page — Implementation Plan

## Problem Summary

When a KnotVite admin copies the RSVP link (`/knotvite/rsvp/{slug}`) and shares it with guests, the page shows a **404 error** ("Page Not Found"). This is because:

1. **No route exists** for `/knotvite/rsvp/:slug` in the frontend router (`App.tsx`). The only RSVP route is `/rsvp/:slug` which points to the `PublicRsvpForm` component — a different system (KnotVite Forms, not event-level RSVP).
2. **No backend API** exists to serve KnotVite event data by RSVP slug (e.g., `/api/knotvite/public/rsvp/:slug`).
3. **No public RSVP page component** exists for KnotVite events.
4. **No RSVP response table** exists in the schema for KnotVite — `knotvite_guests` has `rsvpStatus` and `attendeeCount` columns but there's no dedicated response tracking table like Oak RSVP has.
5. **No landing page customization** settings exist for KnotVite events — the schema has no fields for hero images, colors, welcome messages, etc.

---

## What Oak RSVP Already Has (Reference Implementation)

### Oak RSVP Architecture (3 Files)
| File | Purpose |
|------|---------|
| `oak-rsvp.tsx` | Admin dashboard — guest management, responses, follow-ups, outreach (WhatsApp messaging) |
| `rsvp-wedding-page.tsx` | Public landing page — beautiful hero section, countdown timer, name search, self-registration, then redirects to form |
| `event-rsvp.tsx` | Public RSVP form — multi-step form with attendance, ceremonies, meal, pickup, accommodation, transport, tours, departure |

### Oak RSVP Landing Page Features (`rsvp-wedding-page.tsx`)
- **Hero section** with full-screen photo, couple names extracted from title, parallax scrolling, overlay gradient
- **Customizable elements** (from `LandingConfig` stored in `event.rsvpSettings.landingPage`):
  - `heroImageUrl` — main banner photo
  - `heroImagePosition` — vertical position of hero image
  - `groomName`, `brideName` — override auto-extracted names
  - `tagline` — e.g., "Together with their families"
  - `welcomeTitle`, `welcomeMessage` — section below hero
  - `venueImageUrl` — photo of venue
  - `footerMessage`
  - `primaryColor`, `accentColor` — theme colors
  - `rsvpButtonText`, `rsvpSubtext`
  - `showCountdown` — countdown timer toggle
  - `showCeremonies` — ceremonies badges toggle
  - `customMessage` — personal message section
  - `backgroundOverlayOpacity` — hero darkness control
- **Countdown timer** — shows days, hours, minutes, seconds until event
- **Name search** — guest searches their name, selects from results
- **Self-registration** — guest not on list can register themselves
- **Elegant animations** — fade-in, parallax, glass-card effects
- **Floral decorations** — SVG floral corner accents

### Oak RSVP Form Features (`event-rsvp.tsx`)
- **Search step** → **Form step** → **Submitted step**
- Multi-section form controlled by `FormPageSettings`:
  - Attendance status (Yes/No/Maybe)
  - Ceremony selection (checkboxes for each ceremony)
  - Guest count (adults + children)
  - Meal preference (Veg/Non-veg)
  - Airport pickup (flight/train number, date, time, contact person)
  - Accommodation (check-in, check-out, rooms needed)
  - Local transport (pickup/drop dates and times)
  - Post-event tour plans
  - Departure details
  - Secondary contact
  - Hotel allocation (select from options)
  - Dietary restrictions
  - WhatsApp number
  - Special notes/dress code
- Admin can toggle each section on/off via `formPage` settings
- Pre-fills existing responses for re-submission

### Oak RSVP Backend APIs
| Route | Purpose |
|-------|---------|
| `GET /api/rsvp/event/:code` | Get event info by RSVP code (public, no auth) |
| `GET /api/rsvp/event/:code/search` | Search guests by name (public) |
| `POST /api/rsvp/event/:code/respond/:guestId` | Submit RSVP response (public) |
| `POST /api/rsvp/event/:code/self-register` | Self-register as new guest (public) |
| `GET /api/rsvp/event/:code/guest/:guestId` | Get guest details + existing response (public) |
| `PUT /api/events/:id/rsvp-settings` | Save RSVP settings including landing page config (admin) |
| `POST /api/events/:id/rsvp-landing-image` | Upload landing page images (admin) |

### Oak RSVP Settings Management
Settings are stored as JSON in `events.rsvpSettings` column:
```json
{
  "formPage": {
    "headerTopLine": "Together with their families",
    "headerInvitationText": "cordially invite you...",
    "showEventsSection": true,
    "showGuestCount": true,
    "showMealPreference": true,
    "showPickupSection": true,
    "showAccommodationSection": true,
    "showTransportSection": true,
    "showTourSection": false,
    "showDepartureSection": false,
    "showSpecialNotes": true,
    "functionDetails": {
      "Wedding": { "date": "2025-03-15", "time": "6:00 PM", "venue": "Grand Hall" }
    }
  },
  "landingPage": {
    "heroImageUrl": "https://...",
    "groomName": "John",
    "brideName": "Jane",
    "primaryColor": "#4b7c29",
    "accentColor": "#d4a574",
    "showCountdown": true,
    "showCeremonies": true
  },
  "hotelOptions": ["Hotel A", "Hotel B"]
}
```

---

## Implementation Plan for KnotVite

### Phase 1: Database Schema Changes

**1.1 Add landing page config columns to `knotvite_events`:**
- `landingPageConfig` (JSON/text column) — stores `LandingConfig` object
- `formPageConfig` (JSON/text column) — stores `FormPageSettings` object

**1.2 Create `knotvite_rsvp_responses` table:**
```
id, eventId, guestId, attendanceStatus, numberOfAttendees, numberOfAdults,
numberOfChildren, mealPreference, attendingFunctions (text array),
needsAirportPickup, pickupFlightTrainNo, pickupPoint, pickupDate, pickupTime,
pickupContactPerson, needsAccommodation, accommodationCheckIn, accommodationCheckOut,
accommodationRooms, needsTransport, transportPickupDate, transportPickupTime,
transportDropDate, transportDropTime, specialNotes, dietaryRestrictions,
whatsAppNumber, responseSource, respondedAt, createdAt, updatedAt
```

### Phase 2: Backend API Routes

**2.1 Public APIs (no auth required):**
- `GET /api/knotvite/public/rsvp/:slug` — Get event info by slug (landing page data)
- `GET /api/knotvite/public/rsvp/:slug/search` — Search guests by name
- `POST /api/knotvite/public/rsvp/:slug/respond/:guestId` — Submit RSVP
- `POST /api/knotvite/public/rsvp/:slug/self-register` — Self-register
- `GET /api/knotvite/public/rsvp/:slug/guest/:guestId` — Get guest + existing response

**2.2 Admin APIs (JWT auth):**
- `PUT /api/knotvite/events/:id/landing-page` — Save landing page config
- `PUT /api/knotvite/events/:id/form-page` — Save form page config
- `POST /api/knotvite/events/:id/upload-image` — Upload hero/venue images
- `GET /api/knotvite/events/:id/responses` — Get all RSVP responses

### Phase 3: Frontend — Public RSVP Landing Page

**3.1 New file: `client/src/pages/knotvite-rsvp-wedding.tsx`**
- Replicate `rsvp-wedding-page.tsx` behavior
- Full-screen hero with couple photo, names, date
- Countdown timer
- Ceremonies display
- Name search with autocomplete
- Self-registration form
- Redirects to RSVP form after selecting guest

### Phase 4: Frontend — Public RSVP Form

**4.1 New file: `client/src/pages/knotvite-rsvp-form.tsx`**
- Replicate `event-rsvp.tsx` functionality
- All configurable sections (ceremonies, meal, pickup, accommodation, transport, etc.)
- Pre-fill existing responses
- Success/thank-you screen

### Phase 5: Frontend — Landing Page Customization in Settings

**5.1 Add to KnotVite Dashboard Settings tab:**
- Landing Page Settings card:
  - Hero image upload
  - Hero image position slider
  - Groom name / Bride name override
  - Tagline text
  - Welcome title / message
  - Venue image upload
  - Footer message
  - Primary color / accent color pickers
  - RSVP button text
  - Countdown toggle
  - Ceremonies toggle
  - Custom message
  - Background overlay opacity slider

- Form Page Settings card:
  - Toggle switches for each section (pickup, accommodation, transport, tour, departure, etc.)
  - Header top line text
  - Header invitation text
  - Ceremony-specific date/time/venue fields
  - Thank you messages (attending vs not attending)
  - Meal preference toggle
  - Guest count toggle
  - Dress code text
  - Dietary restrictions toggle

### Phase 6: Router & Route Setup

**6.1 Add routes to `App.tsx`:**
```tsx
<Route path="/knotvite/rsvp/:slug" component={KnotviteRsvpWedding} />
<Route path="/knotvite/rsvp/:slug/respond" component={KnotviteRsvpForm} />
```

These are public routes (no auth wrapper needed).

---

## Key Differences from Oak RSVP

| Aspect | Oak RSVP | KnotVite RSVP |
|--------|----------|---------------|
| Auth | Session-based (Oak users) | JWT-based (KnotVite users) |
| Event lookup | By `rsvpCode` in `events` table | By `rsvpSlug` in `knotvite_events` table |
| Settings storage | `events.rsvpSettings` JSON | Separate `landingPageConfig` + `formPageConfig` columns |
| Guest table | `event_guests` | `knotvite_guests` |
| Response table | `rsvp_responses` | `knotvite_rsvp_responses` (new) |
| Image upload | Object Storage | Object Storage (same) |
| Layout | Inside AtBott layout | Standalone (no sidebar/header) |
| Branding | Oak green theme | KnotVite teal theme, customizable |

## Files to Create/Modify

### New Files
1. `client/src/pages/knotvite-rsvp-wedding.tsx` — Public landing page
2. `client/src/pages/knotvite-rsvp-form.tsx` — Public RSVP form

### Modified Files
1. `shared/schema.ts` — Add `landingPageConfig`, `formPageConfig` to `knotviteEvents`, create `knotviteRsvpResponses` table
2. `server/routes.ts` — Add public + admin KnotVite RSVP APIs
3. `client/src/App.tsx` — Add routes for `/knotvite/rsvp/:slug` and `/knotvite/rsvp/:slug/respond`
4. `client/src/pages/knotvite-dashboard.tsx` — Add Landing Page Customization + Form Page Settings to Settings tab
5. `server/storage.ts` — Add storage methods for KnotVite RSVP responses

## Security Considerations
- Public APIs must have rate limiting (like Oak RSVP's `checkRsvpRateLimit`)
- Guest search should be fuzzy but not leak full guest list
- RSVP responses should validate against known guest IDs
- Self-registration should be optional (admin toggle)
- Image uploads need file type + size validation (already exists in Oak)

## Testing Plan
1. Create a KnotVite event with slug
2. Visit `/knotvite/rsvp/{slug}` — should show landing page
3. Search for a guest name — should return results
4. Submit RSVP — should save response and show thank-you
5. Self-register — should create guest and redirect to form
6. Customize landing page from Settings — should reflect on public page
7. Upload images — should display on landing page
8. Toggle form sections — should show/hide on public form

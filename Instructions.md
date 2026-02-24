# KnotVite RSVP - Issues & Fix Plan

## Research Summary

### Problem 1: "Failed to save" when saving Form/Landing Page Settings

**Root Cause:** Authentication ownership mismatch.

**How it works:**
- The KnotVite dashboard routes (`PUT /api/knotvite/events/:id/form-page` and `PUT /api/knotvite/events/:id/landing-page`) use `verifyJWT` middleware
- `verifyJWT` first checks for a Bearer JWT token, then falls back to session-based auth
- After auth, the route checks ownership: `event.userId !== req.user.userId`
- The KnotVite dashboard is accessed from the main AtBott app layout (session-based auth)
- When users log in via the main app, they get session auth (not JWT)
- If the user's `auth_token` in localStorage expired or was never set (they didn't go through KnotVite signup flow), the Bearer token auth fails silently, falling back to session
- The ownership check then compares session userId with event.userId - this should match if the same user created the event, BUT there could be edge cases:
  - SuperAdmin accessing other users' events
  - Company-level access (companyId) not being checked — superadmin should manage ALL company events
  - Error in storage.updateKnotviteEvent not being properly surfaced (500 without logging)

**Files involved:**
- `server/routes.ts` lines 21380-21401 (landing-page and form-page PUT routes)
- `client/src/pages/knotvite-dashboard.tsx` lines 846-862 (saveFormConfig function)
- `server/routes.ts` lines 103-131 (verifyJWT function)

**Fix:**
1. Add company-level access check (not just userId) so superadmins can manage all company events
2. Add detailed error logging to surface the actual failure reason
3. Ensure the frontend sends proper credentials for session fallback

### Problem 2: RSVP Link Creation & Slug Management

**How it currently works:**
- When creating an event (`POST /api/knotvite/events`), a random 6-character alphanumeric slug is generated
- The slug is stored in `rsvp_slug` column
- The RSVP link format is: `{origin}/knotvite/rsvp/{slug}`
- Users cannot customize or regenerate the slug

**Issues:**
- No way to set a custom/meaningful slug (e.g., "rahul-priya-wedding")
- No slug uniqueness validation
- No way to regenerate a slug if needed
- The slug is only visible in the Settings tab but there's no dedicated "copy link" flow on the main overview

**Files involved:**
- `server/routes.ts` lines 21176-21225 (event creation with slug generation)
- `server/routes.ts` lines 21227-21241 (event update - allows rsvpSlug in fields)
- `client/src/pages/knotvite-dashboard.tsx` lines 1690-1726, 2076-2083 (RSVP link display)

**Fix:**
1. Add slug uniqueness validation on create and update
2. Allow custom slug editing with validation (alphanumeric + hyphens)
3. Add a "Regenerate Slug" button
4. Add prominent RSVP link section with copy/preview buttons in the overview

### Problem 3: Public RSVP Page Quality

**Current state:**
- Landing page (knotvite-rsvp-wedding.tsx) - 663 lines, has hero, countdown, search, self-register
- Form page (knotvite-rsvp-form.tsx) - 724 lines, has multi-step form with all sections

**Oak RSVP reference (rsvp-wedding-page.tsx):**
- Similar landing page with customizable hero, countdown, name search, self-registration
- Uses `landingPage` config from event settings: heroImageUrl, heroImagePosition, groomName, brideName, tagline, welcomeTitle, welcomeMessage, venueImageUrl, footerMessage, primaryColor, accentColor, rsvpButtonText, rsvpSubtext, showCountdown, showCeremonies, customMessage, backgroundOverlayOpacity

**Gaps to fix:**
- Ensure all landing page config fields from Oak RSVP are supported
- Ensure form sections match what's configured in settings
- Add proper error handling for expired/inactive events
- Ensure mobile-first responsive design

### Problem 4: Settings UI - Landing Page Customization

**Current dashboard settings have:**
- Landing Page: hero/venue image upload, primary/accent color, text overrides, toggles
- Form Page: section toggles (12 sections), custom header/thank you messages

**Needs:**
- Save must work reliably (fix auth issue above)
- Preview button should open the actual RSVP page
- Image upload should show current image thumbnails
- All config fields should round-trip correctly (save -> load)

## Files Modified in This Fix

1. `server/routes.ts` - Fix auth checks, add slug validation, improve error handling
2. `client/src/pages/knotvite-dashboard.tsx` - Fix save functions, improve RSVP link management
3. `client/src/pages/knotvite-rsvp-wedding.tsx` - Ensure all config fields are used properly
4. `client/src/pages/knotvite-rsvp-form.tsx` - Ensure all section toggles work correctly
5. `shared/schema.ts` - Verify schema matches

## Fix Implementation Order

1. Fix the "Failed to save" error (auth + ownership check)
2. Fix RSVP slug creation with uniqueness + custom slug support
3. Review and harden the public RSVP pages
4. End-to-end testing

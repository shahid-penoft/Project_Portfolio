# Volunteers Feature — Full Stack Implementation Plan

> **Scope**: Two UIs — `MLAConnectVolunteersPage` (public-facing) and admin `VolunteersPage` — both calling `volunteersService.js`. The backend has **no volunteers routes, no controller, no model, and no DB table** — this is a fully new feature.

---

## Section 1 — UI Inventory

### Screen A: `MLAConnectVolunteersPage` (`/mla-connect/volunteers`)
> Public-facing volunteers directory. Read-only with filters. Uses `volunteersService.getVolunteers()` as fallback.

- [ ] A1 > Back to Engage Center button (button, optional, navigates to `/mla-connect/engage`)
- [ ] A2 > Page hero heading — "Kothamangalam Constituency Volunteers" (static text)
- [ ] A3 > Page hero description paragraph (static text)
- [ ] A4 > Register as Volunteer button (button, optional, navigates to `/mla-connect/engage/register?type=volunteer`)
- [ ] A5 > Sector filter pills — "All", "Disaster Relief & Rescue", "Medical & Health Support", "Event & Rally Coordination", "Community Service", "Youth & Sports", "Senior Citizen Assistance" (multi-button toggle, optional, updates `?sector=` URL search param)
- [ ] A6 > Clear Filters button (button, conditional — shown only when `hasActiveFilters` is true)
- [ ] A7 > Search input (text input, optional, placeholder: "Search volunteer by name, skill, area…", searches `name`, `panchayat`, `ward`, `skills`)
- [ ] A8 > Local Body dropdown (select, optional, populated from `LOCAL_BODIES_FULL_DATA`, filters by `panchayat === filterLocalBody`)
- [ ] A9 > Ward dropdown (select, optional, disabled until Local Body selected, populated from `LOCAL_BODIES_FULL_DATA[selected].wards`, filters by `ward === filterWard`)
- [ ] A10 > Volunteer cards grid (1/2/3/4 columns responsive, paginated)
  - [ ] A10a > Volunteer avatar initials (computed from name, colored by char code)
  - [ ] A10b > Verified badge (conditional — green checkmark if `v.verified === true`)
  - [ ] A10c > Volunteer name (text)
  - [ ] A10d > Panchayat / local body name (text)
  - [ ] A10e > Ward (text, conditional — shown if `v.ward` is truthy)
  - [ ] A10f > Sector badge (text badge, value from `v.sector`, defaults to "General Volunteer")
  - [ ] A10g > Skills text (text, conditional — shown if `v.skills` is truthy, line-clamp-2)
  - [ ] A10h > Call Volunteer button (`<a href="tel:...">`, required phone)
- [ ] A11 > Pagination component (shown when `totalPages > 1`, page size = 12)
- [ ] A12 > Empty state (shown when `pageItems.length === 0`): Users icon + "No Volunteers Found" text
- [ ] A13 > Loading state (internal `loading` state, no visible spinner in current JSX — data falls back to `SAMPLE_VOLUNTEERS` hardcoded array on API error)

---

### Screen B: Admin `VolunteersPage` (`/admin/dashboard/website-pages/volunteers`)
> Protected admin page. Full CRUD. Uses `volunteersService` with real API calls.

- [ ] B1 > Page header title — "Volunteers Directory" (static)
- [ ] B2 > Page header description — "Coordinate and manage youth & community volunteer corps…" (static)
- [ ] B3 > Add Volunteer button (button, opens `AddVolunteerDrawer` in create mode)
- [ ] B4 > Stats Cards row (4 cards, computed from loaded volunteer data)
  - [ ] B4a > Total Volunteers count card
  - [ ] B4b > Active Volunteers count card (status === "Active")
  - [ ] B4c > Emergency Squad count card (category === "Emergency Response")
  - [ ] B4d > Senior Care Volunteers count card (category === "Care Visits")
- [ ] B5 > Search & Filter bar (`SearchFilterBar` component)
  - [ ] B5a > Search text input (debounced 300ms, searches `name`, `phone`, `panchayat`, `ward`, `category`)
  - [ ] B5b > Filter panel button (shows active filter count badge)
  - [ ] B5c > Status filter (multi-select checkboxes: "Active", "On Call", "Inactive")
  - [ ] B5d > Availability filter (multi-select checkboxes: "Weekends", "Weekdays", "Emergency On-Call")
  - [ ] B5e > Local Body filter (multi-select checkboxes, dynamically built from loaded volunteers)
- [ ] B6 > Activity category tabs ("All", "Care Visits", "Camp Support", "Emergency Response", "Youth Activities" with counts from `meta.counts`)
- [ ] B7 > Volunteers table (`VolunteersTable` component)
  - [ ] B7a > Table header row: #, Volunteer Name, Contact Phone, Activity Preference, Panchayat/Ward, Availability, Status, Actions
  - [ ] B7b > Serial number column
  - [ ] B7c > Volunteer Name + ID (mono font ID below name)
  - [ ] B7d > Contact Phone (clickable `tel:` link)
  - [ ] B7e > Activity Preference badge (colored by category)
  - [ ] B7f > Panchayat & Ward (two-line text)
  - [ ] B7g > Availability (text, defaults to "Weekends")
  - [ ] B7h > Status badge (colored: Active=green, On Call=amber, Inactive=slate)
  - [ ] B7i > Actions dropdown (per-row): "View Profile", "Edit Volunteer", "Toggle Status", "Delete"
  - [ ] B7j > Row click → opens `VolunteerDetailDrawer`
  - [ ] B7k > Loading state: "Loading volunteers corps directory..." text
  - [ ] B7l > Empty state: "No volunteers found matching the current filters." text
- [ ] B8 > Pagination component (shown when `totalPages > 1`, page size = 15)

---

### Screen C: `AddVolunteerDrawer` (modal drawer, opened from VolunteersPage)
> Used for both Create and Edit. Triggered by B3 (create) or B7i "Edit Volunteer" (edit).

- [ ] C1 > Drawer title — "Register New Volunteer" or "Edit Volunteer Profile" (conditional on `isEdit`)
- [ ] C2 > Profile photo upload area (optional)
  - [ ] C2a > Circular avatar preview (shown if `profilePhotoPreview` is set)
  - [ ] C2b > Click avatar to change photo (hover overlay)
  - [ ] C2c > Remove photo button (red X badge, shown when photo exists)
  - [ ] C2d > Upload Photo / Change Photo button
  - [ ] C2e > Hidden file input (`accept="image/*"`)
  - [ ] C2f > Validation: image type only, max 5 MB
  - [ ] C2g > Helper text: "JPG, PNG or WEBP · Max 5 MB"
- [ ] C3 > Full Name field (text input, required, max 100 chars, character counter shown)
- [ ] C4 > Primary Phone Number (PhoneInput, required)
- [ ] C5 > Alternative Phone (PhoneInput, optional)
- [ ] C6 > Email field (text input, optional, email format validated via `getEmailError`)
- [ ] C7 > Local Body dropdown (select, required, fetched from `locationService.getAllLocalBodies()`, falls back to `LOCAL_BODIES_FULL_DATA`)
- [ ] C8 > Ward dropdown (select, optional, disabled until Local Body selected, fetched from `locationService.getWardsByLocalBodyId(localBodyId)`, shows "N/A (No Wards Available)" if empty)
- [ ] C9 > Primary Activity Preference dropdown (select, required, options: "Care Visits", "Camp Support", "Emergency Response", "Youth Activities")
- [ ] C10 > Volunteer Status dropdown (select, optional, options: "Active", "On Call", "Inactive", default "Active")
- [ ] C11 > Notes & Orientation Remarks textarea (optional, max 500 chars, character counter shown)
- [ ] C12 > Cancel button (closes drawer, clears form)
- [ ] C13 > Save Volunteer / Update Volunteer button (conditional label, triggers API call)
- [ ] C14 > Inline field-level validation error messages (name, phone, email, notes)
- [ ] C15 > Toast error on validation failure: "Please fill in all required fields"

---

### Screen D: `VolunteerDetailDrawer` (read-only modal drawer)
> Opened by clicking a row in B7 or "View Profile" in B7i.

- [ ] D1 > Drawer title — "Volunteer Profile" (static)
- [ ] D2 > Hero banner card: Users icon, volunteer name, ID (mono), category badge (colored), status badge
- [ ] D3 > Call Mobile button (`<a href="tel:...">`, links to `entry.phone`)
- [ ] D4 > Send WhatsApp button (`<a href="https://wa.me/...">`, links to sanitized `entry.phone`)
- [ ] D5 > Contact Information section
  - [ ] D5a > Primary Mobile Number (display)
  - [ ] D5b > Alternative Contact (display, conditional — shown if `entry.alternatePhone` is truthy)
  - [ ] D5c > Copy Phone button (copies to clipboard, changes to "Copied" for 2s on success)
- [ ] D6 > Local Body & Ward section (MapPin icon + panchayat name + ward in parentheses)
- [ ] D7 > Availability Schedule section (Calendar icon + `entry.availability || "Weekends"`)
- [ ] D8 > Special Skills & Qualifications section (conditional — shown if `skillsList.length > 0`, displays skill tags)
- [ ] D9 > Admin Notes & Orientation Remarks section (conditional — shown if `entry.notes` truthy, blockquote-style text)
- [ ] D10 > Close button (closes drawer)
- [ ] D11 > Edit Volunteer Profile button (closes detail drawer, opens edit drawer)

---

## Section 2 — API Contract

> All endpoints below are **⚠️ NEW** — no volunteers routes exist in the backend.
> Base path: `/api/volunteers`
> Auth middleware: All write endpoints require admin `verifyToken`. GET (public list) is open.
> File upload: Uses existing `multerS3.uploadImage` (same as blood donors).

---

### 2.1 — GET /api/volunteers

| UI Element | Screen | Method + Path | Request Schema | Response Schema | Validation Rules | DB table.column |
|---|---|---|---|---|---|---|
| A10 Volunteer cards grid | MLAConnectVolunteersPage | `GET /api/volunteers` | Query: `?sector=`, `?search=`, `?local_body_id=`, `?ward_id=`, `?page=`, `?limit=` | `{ success, data: Volunteer[], meta: { total, counts: { All, "Care Visits", "Camp Support", "Emergency Response", "Youth Activities" } } }` | — | `volunteers.*` |
| B7 Volunteers table | Admin VolunteersPage | `GET /api/volunteers` | Same as above | Same as above (with `status`, `availability` filter) | — | `volunteers.*` |

---

### 2.2 — POST /api/volunteers (Create)

| UI Element | Screen | Method + Path | Request Schema | Response Schema | Validation Rules | DB table.column |
|---|---|---|---|---|---|---|
| C13 Save Volunteer button | AddVolunteerDrawer | `POST /api/volunteers` | `multipart/form-data`: `name*`, `phone*`, `email?`, `alternatePhone?`, `localBodyId?`, `panchayat?`, `wardId?`, `ward?`, `category*`, `status?`, `availability?`, `skills?` (JSON string or comma-sep), `notes?`, `profilePhoto?` (file) | `{ success, message, data: Volunteer }` | `name` required, max 100; `phone` required; `email` valid format if provided; `notes` max 500; `category` must be one of enum; `status` must be one of enum | `volunteers.name`, `.phone`, `.email`, `.alternate_phone`, `.local_body_id`, `.panchayat`, `.ward_id`, `.ward`, `.category`, `.status`, `.availability`, `.skills` (JSON), `.notes`, `.profile_photo_url`, `.verified` (default false), `.joined_date` (NOW()) |

---

### 2.3 — PUT /api/volunteers/:id (Update)

| UI Element | Screen | Method + Path | Request Schema | Response Schema | Validation Rules | DB table.column |
|---|---|---|---|---|---|---|
| C13 Update Volunteer button | AddVolunteerDrawer (edit mode) | `PUT /api/volunteers/:id` | Same as POST but all optional; also accepts `profilePhoto` file for photo change | `{ success, message, data: Volunteer }` | Same as POST | `volunteers.*` |
| B7i Toggle Status action | VolunteersTable | `PUT /api/volunteers/:id` | `{ status: "Active" \| "On Call" }` | `{ success, message }` | `status` must be enum value | `volunteers.status` |

---

### 2.4 — DELETE /api/volunteers/:id

| UI Element | Screen | Method + Path | Request Schema | Response Schema | Validation Rules | DB table.column |
|---|---|---|---|---|---|---|
| B7i Delete action | VolunteersTable | `DELETE /api/volunteers/:id` | Params: `id` | `{ success, message }` | `id` must exist | `volunteers.id` |

---

### 2.5 — POST /api/volunteers/upload-image (Photo Upload)

| UI Element | Screen | Method + Path | Request Schema | Response Schema | Validation Rules | DB table.column |
|---|---|---|---|---|---|---|
| C2 Profile photo upload | AddVolunteerDrawer | `POST /api/volunteers/upload-image` | `multipart/form-data`: `image` (file field) | `{ success, data: { url } }` | image type only; max 5 MB | `volunteers.profile_photo_url` |

> **Note**: The frontend currently bundles the photo as part of the create/update form. A separate upload-image endpoint matches the blood donor pattern and allows progressive enhancement.

---

### 2.6 — Response Shape: Volunteer Object

```json
{
  "id": "VOL-201",
  "name": "Sujith Narayanan",
  "phone": "+91 98460 11223",
  "alternatePhone": "+91 98460 99887",
  "email": "sujith@example.com",
  "localBodyId": 3,
  "panchayat": "Kothamangalam Municipality",
  "wardId": 12,
  "ward": "Ward 12",
  "category": "Emergency Response",
  "skills": ["First Aid", "Driving", "Disaster Rescue"],
  "availability": "Emergency On-Call",
  "status": "Active",
  "verified": true,
  "profilePhotoUrl": "https://cdn.example.com/volunteers/vol201.jpg",
  "joinedDate": "2025-08-10",
  "notes": "Leads emergency response squad",
  "createdAt": "2025-08-10T00:00:00Z"
}
```

---

## Section 3 — Build Order

A numbered, sequential list of every build step. No step is implicit.

---

### Step 1 — DB Schema: Create `volunteers` table

Create a new versioned migration file: `migrate_volunteers.js`

```sql
CREATE TABLE IF NOT EXISTS volunteers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100)  NOT NULL,
  phone           VARCHAR(20)   NOT NULL,
  alternate_phone VARCHAR(20)   DEFAULT NULL,
  email           VARCHAR(150)  DEFAULT NULL,
  local_body_id   INT           DEFAULT NULL,
  panchayat       VARCHAR(150)  DEFAULT NULL,
  ward_id         INT           DEFAULT NULL,
  ward            VARCHAR(150)  DEFAULT NULL,
  category        ENUM(
    'Care Visits',
    'Camp Support',
    'Emergency Response',
    'Youth Activities'
  ) NOT NULL DEFAULT 'Care Visits',
  status          ENUM(
    'Active',
    'On Call',
    'Inactive'
  ) NOT NULL DEFAULT 'Active',
  availability    VARCHAR(100)  DEFAULT 'Weekends',
  skills          JSON          DEFAULT NULL,
  notes           TEXT          DEFAULT NULL,
  profile_photo_url VARCHAR(500) DEFAULT NULL,
  verified        TINYINT(1)    NOT NULL DEFAULT 0,
  joined_date     DATE          DEFAULT (CURDATE()),
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_status   (status),
  INDEX idx_local_body (local_body_id)
);
```

---

### Step 2 — DB Migration: Run `migrate_volunteers.js`

Write a standalone migration script (`migrate_volunteers.js` in Backend root) that:
1. Connects to DB via existing `./configs/db.js`
2. Executes the `CREATE TABLE IF NOT EXISTS` SQL above
3. Logs success or error and exits

---

### Step 3 — Model: `models/volunteerModel.js`

Create `Backend/models/volunteerModel.js` exporting these functions:

| Function | SQL Operation |
|---|---|
| `fetchAllVolunteers(filters)` | SELECT with optional WHERE on `category`, `status`, `local_body_id`, `ward_id`, LIKE on `name`/`phone`/`panchayat`/`ward` + `skills`, LIMIT/OFFSET for pagination |
| `fetchVolunteerById(id)` | SELECT WHERE id = ? |
| `insertVolunteer(data)` | INSERT into volunteers |
| `updateVolunteerInDB(id, data)` | UPDATE volunteers WHERE id = ? |
| `deleteVolunteerInDB(id)` | DELETE WHERE id = ? |
| `fetchCategoryCounts()` | SELECT category, COUNT(*) GROUP BY category |

---

### Step 4 — Validation Middleware: `middlewares/validateVolunteer.js`

Create `Backend/middlewares/validateVolunteer.js` that:
- Validates `name`: required, max 100 chars
- Validates `phone`: required, non-empty
- Validates `email`: valid email format if provided (use existing pattern from blood donor)
- Validates `category`: must be one of the 4 enum values
- Validates `status`: must be one of the 3 enum values
- Validates `notes`: max 500 chars
- Strips/sanitizes extra fields
- Attaches `req.sanitizedVolunteer` for controller use

---

### Step 5 — Controller: `controllers/volunteersController.js`

Create `Backend/controllers/volunteersController.js` with these exported functions:

| Function | Route | Description |
|---|---|---|
| `uploadVolunteerImage` | POST /upload-image | Runs `runMulter(uploadImage)`, returns `{ success, data: { url } }` |
| `getVolunteers` | GET / | Calls `fetchAllVolunteers(req.query)`, returns `{ success, data, meta: { total, counts } }` |
| `getVolunteerById` | GET /:id | Calls `fetchVolunteerById(id)`, 404 if not found |
| `createVolunteer` | POST / | Calls `insertVolunteer(req.sanitizedVolunteer)`, returns 201 |
| `updateVolunteer` | PUT /:id | Calls `updateVolunteerInDB(id, data)`, returns updated record |
| `deleteVolunteer` | DELETE /:id | Calls `deleteVolunteerInDB(id)`, returns success message |

---

### Step 6 — Routes: `routes/volunteersRoutes.js`

Create `Backend/routes/volunteersRoutes.js`:

```
POST   /api/volunteers/upload-image   → uploadVolunteerImage (multer middleware)
GET    /api/volunteers                → getVolunteers (public, no auth)
GET    /api/volunteers/:id            → getVolunteerById (public)
POST   /api/volunteers                → verifyToken, validateVolunteer, createVolunteer
PUT    /api/volunteers/:id            → verifyToken, validateVolunteerUpdate, updateVolunteer
DELETE /api/volunteers/:id            → verifyToken, deleteVolunteer
```

Add registration limiter on POST (max 10/15min per IP) mirroring bloodDonorRoutes pattern.

---

### Step 7 — Wire Route to Express: `index.js`

Add to `Backend/index.js`:

```js
import volunteersRoutes from './routes/volunteersRoutes.js';
// ... (after bloodDonorRoutes line ~63)
app.use('/api/volunteers', volunteersRoutes);
```

---

### Step 8 — Error Handling

All controller functions must:
- Wrap logic in `try/catch`
- Log errors: `console.error('[functionName error]:', err)`
- Return `500` with `{ success: false, message: '...' }` on unhandled errors
- Return `404` if record not found by ID

---

### Step 9 — Frontend Service: Verify `volunteersService.js`

The frontend service at `src/services/volunteersService.js` already calls:
- `GET /api/volunteers` → `getVolunteers()`
- `POST /api/volunteers` → `addVolunteer(data)`
- `PUT /api/volunteers/:id` → `updateVolunteer(id, data)`
- `DELETE /api/volunteers/:id` → `deleteVolunteer(id)`

**No changes needed** to the service file itself — it has localStorage fallback already.
However, verify the API response shape matches what service expects (`res.success`, `res.data`, `res.meta.counts`).

---

### Step 10 — Verify Public Page (`MLAConnectVolunteersPage`)

After backend is live, the public page (`/mla-connect/volunteers`) should:
- Successfully call `GET /api/volunteers` and display real data (not SAMPLE_VOLUNTEERS)
- Apply all client-side filters correctly (`sector`, `search`, `local body`, `ward`)
- Paginate correctly (page size 12)
- Show the "No Volunteers Found" empty state when filtered results are empty

---

### Step 11 — Verify Admin Page (`VolunteersPage`)

After backend is live, the admin page should:
- Load volunteers from API, show stats cards with real counts
- Tabs must show correct category counts from `res.meta.counts`
- Add Volunteer flow: opens drawer → fills form → POST → toast success → list refreshes
- Edit Volunteer flow: opens drawer pre-filled → PUT → toast success → list refreshes
- Toggle Status: inline PUT → toast success → list refreshes
- Delete: DELETE → toast success → list refreshes
- View Profile drawer shows all fields from the DB record

---

## Section 4 — Self-check Checklist

> Exact copy of Section 1 checkboxes — all unchecked. Use this after implementation to verify nothing was missed.

### Screen A: `MLAConnectVolunteersPage`

- [ ] A1 > Back to Engage Center button (button, optional, navigates to `/mla-connect/engage`)
- [ ] A2 > Page hero heading — "Kothamangalam Constituency Volunteers" (static text)
- [ ] A3 > Page hero description paragraph (static text)
- [ ] A4 > Register as Volunteer button (button, optional, navigates to `/mla-connect/engage/register?type=volunteer`)
- [ ] A5 > Sector filter pills — "All", "Disaster Relief & Rescue", "Medical & Health Support", "Event & Rally Coordination", "Community Service", "Youth & Sports", "Senior Citizen Assistance" (multi-button toggle, optional, updates `?sector=` URL search param)
- [ ] A6 > Clear Filters button (button, conditional — shown only when `hasActiveFilters` is true)
- [ ] A7 > Search input (text input, optional, placeholder: "Search volunteer by name, skill, area…", searches `name`, `panchayat`, `ward`, `skills`)
- [ ] A8 > Local Body dropdown (select, optional, populated from `LOCAL_BODIES_FULL_DATA`, filters by `panchayat === filterLocalBody`)
- [ ] A9 > Ward dropdown (select, optional, disabled until Local Body selected, populated from `LOCAL_BODIES_FULL_DATA[selected].wards`, filters by `ward === filterWard`)
- [ ] A10 > Volunteer cards grid (1/2/3/4 columns responsive, paginated)
  - [ ] A10a > Volunteer avatar initials (computed from name, colored by char code)
  - [ ] A10b > Verified badge (conditional — green checkmark if `v.verified === true`)
  - [ ] A10c > Volunteer name (text)
  - [ ] A10d > Panchayat / local body name (text)
  - [ ] A10e > Ward (text, conditional — shown if `v.ward` is truthy)
  - [ ] A10f > Sector badge (text badge, value from `v.sector`, defaults to "General Volunteer")
  - [ ] A10g > Skills text (text, conditional — shown if `v.skills` is truthy, line-clamp-2)
  - [ ] A10h > Call Volunteer button (`<a href="tel:...">`, required phone)
- [ ] A11 > Pagination component (shown when `totalPages > 1`, page size = 12)
- [ ] A12 > Empty state (shown when `pageItems.length === 0`): Users icon + "No Volunteers Found" text
- [ ] A13 > Loading state (internal `loading` state, no visible spinner in current JSX — data falls back to `SAMPLE_VOLUNTEERS` hardcoded array on API error)

---

### Screen B: Admin `VolunteersPage`

- [ ] B1 > Page header title — "Volunteers Directory" (static)
- [ ] B2 > Page header description — "Coordinate and manage youth & community volunteer corps…" (static)
- [ ] B3 > Add Volunteer button (button, opens `AddVolunteerDrawer` in create mode)
- [ ] B4 > Stats Cards row (4 cards, computed from loaded volunteer data)
  - [ ] B4a > Total Volunteers count card
  - [ ] B4b > Active Volunteers count card (status === "Active")
  - [ ] B4c > Emergency Squad count card (category === "Emergency Response")
  - [ ] B4d > Senior Care Volunteers count card (category === "Care Visits")
- [ ] B5 > Search & Filter bar (`SearchFilterBar` component)
  - [ ] B5a > Search text input (debounced 300ms, searches `name`, `phone`, `panchayat`, `ward`, `category`)
  - [ ] B5b > Filter panel button (shows active filter count badge)
  - [ ] B5c > Status filter (multi-select checkboxes: "Active", "On Call", "Inactive")
  - [ ] B5d > Availability filter (multi-select checkboxes: "Weekends", "Weekdays", "Emergency On-Call")
  - [ ] B5e > Local Body filter (multi-select checkboxes, dynamically built from loaded volunteers)
- [ ] B6 > Activity category tabs ("All", "Care Visits", "Camp Support", "Emergency Response", "Youth Activities" with counts from `meta.counts`)
- [ ] B7 > Volunteers table (`VolunteersTable` component)
  - [ ] B7a > Table header row: #, Volunteer Name, Contact Phone, Activity Preference, Panchayat/Ward, Availability, Status, Actions
  - [ ] B7b > Serial number column
  - [ ] B7c > Volunteer Name + ID (mono font ID below name)
  - [ ] B7d > Contact Phone (clickable `tel:` link)
  - [ ] B7e > Activity Preference badge (colored by category)
  - [ ] B7f > Panchayat & Ward (two-line text)
  - [ ] B7g > Availability (text, defaults to "Weekends")
  - [ ] B7h > Status badge (colored: Active=green, On Call=amber, Inactive=slate)
  - [ ] B7i > Actions dropdown (per-row): "View Profile", "Edit Volunteer", "Toggle Status", "Delete"
  - [ ] B7j > Row click → opens `VolunteerDetailDrawer`
  - [ ] B7k > Loading state: "Loading volunteers corps directory..." text
  - [ ] B7l > Empty state: "No volunteers found matching the current filters." text
- [ ] B8 > Pagination component (shown when `totalPages > 1`, page size = 15)

---

### Screen C: `AddVolunteerDrawer`

- [ ] C1 > Drawer title — "Register New Volunteer" or "Edit Volunteer Profile" (conditional on `isEdit`)
- [ ] C2 > Profile photo upload area (optional)
  - [ ] C2a > Circular avatar preview (shown if `profilePhotoPreview` is set)
  - [ ] C2b > Click avatar to change photo (hover overlay)
  - [ ] C2c > Remove photo button (red X badge, shown when photo exists)
  - [ ] C2d > Upload Photo / Change Photo button
  - [ ] C2e > Hidden file input (`accept="image/*"`)
  - [ ] C2f > Validation: image type only, max 5 MB
  - [ ] C2g > Helper text: "JPG, PNG or WEBP · Max 5 MB"
- [ ] C3 > Full Name field (text input, required, max 100 chars, character counter shown)
- [ ] C4 > Primary Phone Number (PhoneInput, required)
- [ ] C5 > Alternative Phone (PhoneInput, optional)
- [ ] C6 > Email field (text input, optional, email format validated via `getEmailError`)
- [ ] C7 > Local Body dropdown (select, required, fetched from `locationService.getAllLocalBodies()`, falls back to `LOCAL_BODIES_FULL_DATA`)
- [ ] C8 > Ward dropdown (select, optional, disabled until Local Body selected, fetched from `locationService.getWardsByLocalBodyId(localBodyId)`, shows "N/A (No Wards Available)" if empty)
- [ ] C9 > Primary Activity Preference dropdown (select, required, options: "Care Visits", "Camp Support", "Emergency Response", "Youth Activities")
- [ ] C10 > Volunteer Status dropdown (select, optional, options: "Active", "On Call", "Inactive", default "Active")
- [ ] C11 > Notes & Orientation Remarks textarea (optional, max 500 chars, character counter shown)
- [ ] C12 > Cancel button (closes drawer, clears form)
- [ ] C13 > Save Volunteer / Update Volunteer button (conditional label, triggers API call)
- [ ] C14 > Inline field-level validation error messages (name, phone, email, notes)
- [ ] C15 > Toast error on validation failure: "Please fill in all required fields"

---

### Screen D: `VolunteerDetailDrawer`

- [ ] D1 > Drawer title — "Volunteer Profile" (static)
- [ ] D2 > Hero banner card: Users icon, volunteer name, ID (mono), category badge (colored), status badge
- [ ] D3 > Call Mobile button (`<a href="tel:...">`, links to `entry.phone`)
- [ ] D4 > Send WhatsApp button (`<a href="https://wa.me/...">`, links to sanitized `entry.phone`)
- [ ] D5 > Contact Information section
  - [ ] D5a > Primary Mobile Number (display)
  - [ ] D5b > Alternative Contact (display, conditional — shown if `entry.alternatePhone` is truthy)
  - [ ] D5c > Copy Phone button (copies to clipboard, changes to "Copied" for 2s on success)
- [ ] D6 > Local Body & Ward section (MapPin icon + panchayat name + ward in parentheses)
- [ ] D7 > Availability Schedule section (Calendar icon + `entry.availability || "Weekends"`)
- [ ] D8 > Special Skills & Qualifications section (conditional — shown if `skillsList.length > 0`, displays skill tags)
- [ ] D9 > Admin Notes & Orientation Remarks section (conditional — shown if `entry.notes` truthy, blockquote-style text)
- [ ] D10 > Close button (closes drawer)
- [ ] D11 > Edit Volunteer Profile button (closes detail drawer, opens edit drawer)

---

> ✅ PLAN.md complete — ready for your review.
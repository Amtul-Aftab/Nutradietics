# Nutradietics — Design

## Overview

This document describes the technical design for Nutradietics, a marketplace connecting clients with two types of health professionals (nutritionists and fitness trainers). It translates the 14 requirements in `requirements.md` into an architecture, data model, API surface, AI integration contracts, and the client-facing flow.

The core client journey is a linear, stateful pipeline: describe need → AI classifies professional type → collect type-specific standard intake fields → AI generates type-adapted follow-up questions → client answers → AI matches to a professional → book a slot → (before appointment) professional reads AI summary + medical history → (after appointment) professional records diagnosis/plan → everything persists to the client's medical history for future continuity.

### Assumptions (please confirm)

The requirements are stack-agnostic; this design picks a concrete stack consistent with the repo's `.gitignore` (Node/React). Adjust if your intent differs:

- **Application**: A single Next.js (TypeScript) app combining the frontend (React) and the backend (API routes / route handlers). It deploys as one app to one host — no separate SPA and API server.
- **Server-side logic**: Business logic and all AI calls run inside Next.js server code (route handlers and server actions), so provider keys stay server-side (Req 14.1).
- **Database**: PostgreSQL via an ORM (Prisma assumed for schema examples).
- **AI provider**: A single pluggable LLM provider accessed through a server-side adapter, using JSON-structured responses. The design does not hardcode a vendor.
- **Auth**: A well-documented, Next.js-native auth library (Auth.js / NextAuth) rather than hand-rolled JWT/session code. Role-based access is layered on top via the session.

---

## Architecture

### High-level components

A single Next.js app serves both the React UI and the server-side API. The browser talks only to this app; the app talks to PostgreSQL and the LLM provider from server code.

```
┌────────────────────────────────────────────────────────┐
│                   Next.js application                    │
│                                                          │
│  React UI (pages/components)                             │
│   - client intake wizard                                 │
│   - professional dashboard                               │
│        │  (fetch / server actions)                       │
│        ▼                                                 │
│  Server code (route handlers + server actions)           │
│   - Auth.js session & RBAC                               │
│   - Intake pipeline                                      │
│   - Matching / Booking / Medical history                 │
│   - AI Orchestration ────────────────────────┐          │
└───────────────────────────────┬──────────────┼──────────┘
                                 │              │
                                 ▼              ▼
                          ┌───────────┐   LLM Provider
                          │ PostgreSQL│   (server-side key)
                          └───────────┘
```

### Layering

Within the single Next.js app:

- **UI layer**: React pages/components (client and professional dashboards).
- **Server entry points**: Route handlers (`app/api/**/route.ts`) and/or server actions handle HTTP, validation, and auth guards.
- **Services**: Business logic (IntakeService, MatchingService, BookingService, MedicalHistoryService, AiService) invoked from the server entry points.
- **AI adapter**: A single `AiClient` interface wrapping the provider. All four AI operations (classify, generateQuestions, match, summarize) go through it with timeouts, schema validation, and retry semantics (Req 14).
- **Repositories/ORM**: Data access via Prisma.

### Cross-cutting concerns

- **RBAC**: Every protected route handler / server action reads the Auth.js session and checks role (client vs professional) and resource ownership (Req 1.6, 12.6, 13.5).
- **AI resilience**: A shared wrapper enforces timeout → abort → retryable error, and JSON-schema validation of every AI response (Req 14.2, 14.3).
- **Input treated as untrusted**: AI output is rendered as data/text, never executed; client free-text is sanitized on display (Req 14.4).

---

## Authentication & Authorization

Authentication uses **Auth.js (NextAuth)** — a well-documented, Next.js-native library — rather than hand-rolled JWT/session handling. This keeps the auth surface small and focused on the role-based access the requirements need (Req 1).

- **Provider**: Credentials provider (email + password). Passwords are hashed with argon2/bcrypt; the provider verifies the hash on login (Req 1.4, 1.5).
- **Sign-up**: A dedicated route handler creates the `User` (and the matching `Professional` or `ClientProfile`), rejecting duplicate emails with a generic error (Req 1.2, 1.3). Auth.js then establishes the session.
- **Session shape**: The session carries `userId` and `role` (and, for professionals, `professionalType`). Auth.js session/JWT callbacks populate these from the `User` record so every request can authorize without an extra lookup.
- **Route protection**: Middleware guards protected routes; individual route handlers and server actions re-check `role` and resource ownership from the session (Req 1.6, 12.6, 13.5). Sign-out is handled by Auth.js, clearing the session (Req 1.7).
- **Why this over custom auth**: For a time-constrained build, a maintained library gives session management, CSRF protection, and secure cookies out of the box, while still satisfying the role-based requirements. The role/ownership logic — the part that is actually app-specific — stays in our service layer.

---

## Components and Interfaces

The single Next.js app is organized into these components; their detailed contracts appear in the sections that follow (Data Models, AI Integration, API Surface).

- **UI components (React)**: the client intake wizard, professional dashboard (profile, services, availability, schedule, appointment detail), client browse/history views, and shared UI primitives. See `## Frontend (React) Structure`.
- **Route handlers (`app/api/**`)**: the HTTP interface for auth, professional profile/services/slots, the intake pipeline, appointments, and medical history. Each validates input, enforces auth/role, and returns typed JSON. See `## API Surface`.
- **Service layer (`src/lib`)**: business logic invoked by route handlers — `booking`, `matching`, `slots`, `summary`, `medical-history`, plus validation modules. Interfaces are ordinary typed functions.
- **`AiClient` interface**: the four AI operations (`classifyProfessionalType`, `generateFollowUpQuestions`, `matchProfessional`, `summarizePatient`), implemented by the Gemini adapter with structured JSON output and a shared resilience wrapper. See `## AI Integration`.
- **Auth component (Auth.js)**: session/JWT handling and the edge-safe `authConfig` used by the proxy for route protection. See `## Authentication & Authorization`.
- **Data access (Prisma)**: the repository layer over PostgreSQL; the schema and relations are defined in `## Data Models`.

## Intake State Machine

The intake is the backbone of the client flow. It is modeled as a single `Intake` record with an explicit `status` so the UI can resume and each AI step is idempotent-ish and retryable (Req 6.3, 8.6, 9.6).

```
DESCRIBED
   │  (AI classify — Req 6)
   ▼
CLASSIFIED  ── professionalType set (nutritionist | fitness_trainer)
   │  (client submits standard fields — Req 7)
   ▼
FIELDS_COLLECTED
   │  (AI generate follow-up questions — Req 8)
   ▼
QUESTIONS_READY
   │  (client submits answers — Req 8.7)
   ▼
ANSWERED
   │  (AI match — Req 9;  AI summary — Req 10.1)
   ▼
MATCHED
   │  (client books a slot — Req 11)
   ▼
BOOKED
```

Notes:
- Each AI-driven transition can fail and be retried without losing prior state (the record stays in the pre-transition status; the client keeps their input). This satisfies the "retry without losing input" criteria across Req 6/8/9/10.
- The patient summary (Req 10) is generated at the `ANSWERED → MATCHED` step so it is ready before booking; it is stored regardless of who is matched.

---

## Data Models

Relational schema (PostgreSQL). Types shown in Prisma-like syntax for clarity.

### Enums

```prisma
enum Role            { CLIENT  PROFESSIONAL }
enum ProfessionalType{ NUTRITIONIST  FITNESS_TRAINER }
enum Gender          { MALE  FEMALE  OTHER  UNSPECIFIED }
enum IntakeStatus    { DESCRIBED  CLASSIFIED  FIELDS_COLLECTED  QUESTIONS_READY  ANSWERED  MATCHED  BOOKED }
enum SlotStatus      { AVAILABLE  BOOKED  REMOVED }
enum AppointmentStatus { CONFIRMED  COMPLETED  CANCELLED }
enum PaymentStatus    { PENDING  PAID }
```

### Core tables

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  role          Role
  emailVerified Boolean  @default(false) // set true via /api/verify-email; optional, non-blocking (Req 17)
  createdAt     DateTime @default(now())

  professional  Professional?   // set when role = PROFESSIONAL
  clientProfile ClientProfile? // set when role = CLIENT
  verificationTokens VerificationToken[]
}

// Single-use, 24h email verification tokens (Req 17). Non-blocking flow:
// signup issues one and emails a link; /api/verify-email consumes it and sets
// emailVerified. Sign-in does NOT check emailVerified — verification is
// optional and never blocks access.
model VerificationToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Professional {
  id        String           @id @default(uuid())
  userId    String           @unique
  user      User             @relation(fields: [userId], references: [id])
  name      String
  type      ProfessionalType            // Req 1.2, 2.4
  specialty String
  bio       String?
  avatarUrl String?                      // Supabase Storage public URL (Req 15)
  services  Service[]
  slots     TimeSlot[]
  appointments Appointment[]
  reviews   Review[]                     // Req 16
}

model ClientProfile {
  id       String   @id @default(uuid())
  userId   String   @unique
  user     User     @relation(fields: [userId], references: [id])
  name     String?
  intakes  Intake[]
  appointments Appointment[]
  reviews  Review[]                    // Req 16
  // medical history is derived from intakes + summaries + session records
}

model Service {
  id             String           @id @default(uuid())
  professionalId String
  professional   Professional     @relation(fields: [professionalId], references: [id])
  type           ProfessionalType // denormalized from professional for match filtering (Req 3.1)
  specialty      String
  description    String
  priceCents     Int              // whole PKR amount; validated integer >= 0 (Req 3.3). Legacy column name; holds rupees, not paisa. Displayed as "Rs 5,000".
  active         Boolean          @default(true)
}

model TimeSlot {
  id             String       @id @default(uuid())
  professionalId String
  professional   Professional @relation(fields: [professionalId], references: [id])
  startsAt       DateTime
  endsAt         DateTime
  status         SlotStatus   @default(AVAILABLE)
  // overlap prevention enforced by an application-level check in the service layer (Req 4.2)
}

model Intake {
  id               String        @id @default(uuid())
  clientProfileId  String
  clientProfile    ClientProfile @relation(fields: [clientProfileId], references: [id])
  description      String
  professionalType ProfessionalType?          // set at CLASSIFIED (Req 6)
  standardFields   Json?                       // type-specific field set (Req 7)
  status           IntakeStatus  @default(DESCRIBED)
  createdAt        DateTime      @default(now())

  questions   FollowUpQuestion[]
  match       Match?
  summary     PatientSummary?
  appointment Appointment?
}

model FollowUpQuestion {
  id       String  @id @default(uuid())
  intakeId String
  intake   Intake  @relation(fields: [intakeId], references: [id])
  order    Int
  question String
  answer   String?          // filled at ANSWERED (Req 8.7)
}

model Match {
  id                    String       @id @default(uuid())
  intakeId              String       @unique
  intake                Intake       @relation(fields: [intakeId], references: [id])
  matchedProfessionalId String
  rationale             String       // AI-provided reasoning (Req 9.4)
  createdAt             DateTime     @default(now())
}

model PatientSummary {
  id        String   @id @default(uuid())
  intakeId  String   @unique
  intake    Intake   @relation(fields: [intakeId], references: [id])
  summary   String                    // AI-generated (Req 10)
  createdAt DateTime @default(now())
}

model Appointment {
  id               String            @id @default(uuid())
  intakeId         String            @unique
  clientProfileId  String
  professionalId   String
  timeSlotId       String            @unique
  status           AppointmentStatus @default(CONFIRMED)
  meetingLink      String?           // professional-set video call URL (Req 11.6)
  paymentStatus    PaymentStatus     @default(PENDING) // off-platform payment (Req 11.7)
  createdAt        DateTime          @default(now())

  sessionRecord    SessionRecord?
}

model SessionRecord {
  id             String      @id @default(uuid())
  appointmentId  String      @unique
  professionalId String                     // author; only they may edit (Req 12.6)
  diagnosis      String                     // professional-entered, NOT AI (Req 12.2)
  plan           String
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}

model Review {
  id              String        @id @default(uuid())
  appointmentId   String        @unique      // at most one review per appointment (Req 16.3)
  clientProfileId String
  clientProfile   ClientProfile @relation(fields: [clientProfileId], references: [id])
  professionalId  String
  professional    Professional  @relation(fields: [professionalId], references: [id])
  rating          Int                        // 1..5, validated (Req 16.1, 16.2)
  text            String?                     // optional short review
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}
```

### Standard intake fields (`Intake.standardFields` JSON shape)

Stored as JSON because the field set differs by type (Req 7). Validated server-side against a type-specific schema.

Shared (both types):
```json
{
  "age": 34,
  "weightKg": 78.5,
  "heightCm": 175,
  "gender": "male",
  "activityLevel": "moderate",
  "medicalConditions": "…",
  "medicalHistory": "…",
  "allergies": "…"
}
```

Nutritionist-only additions (Req 7.1):
```json
{
  "currentSymptoms": "…",
  "recentReports": "brief free-text summary of tests/reports from the last 6 months"
}
```

`recentReports` is free text only — no file upload accepted (Req 7.3). Fitness-trainer intakes must not include `currentSymptoms` or `recentReports` (Req 7.2); server validation rejects them if present.

### Medical history (derived, not a table)

Medical history (Req 13) is a read-model assembled from the client's `Intake`, `PatientSummary`, and `SessionRecord` rows, ordered chronologically. Keeping it derived avoids duplication and guarantees it always reflects source records.

---

## AI Integration

All AI work flows through a single server-side `AiClient` with one method per task. Each method: builds a prompt, calls the provider with a timeout, parses JSON, and validates against a schema. Any failure (timeout, non-JSON, schema mismatch, out-of-range value) throws a typed `AiUnavailableError` that controllers map to a retryable HTTP response (Req 14.2, 14.3).

### Contracts

**1. classifyProfessionalType** (Req 6)
- Input: `{ description }`
- Output schema: `{ "professionalType": "nutritionist" | "fitness_trainer" }`
- Validation: value must be exactly one of the two; otherwise treated as unusable → retry (Req 6.4).

**2. generateFollowUpQuestions** (Req 8)
- Input: `{ description, professionalType, standardFields }`
- Output schema: `{ "questions": string[] }`
- Prompt steering: for `nutritionist`, bias toward diet/eating/restrictions/goals; for `fitness_trainer`, bias toward training history/injuries/limitations (Req 8.2, 8.3).
- Post-processing: clamp to 3–5 questions — if >5, keep first 5; if <3, treat as unusable and retry (Req 8.5).

**3. matchProfessional** (Req 9)
- Input: `{ description, standardFields, answers, candidates: [{ professionalId, type, specialty, serviceDescriptions }] }`
- Candidates are pre-filtered by the server: type == identified type (Req 9.2) AND has ≥1 active service AND ≥1 available slot (Req 9.3). If the candidate list is empty, the server does NOT call the AI and returns "no match available" (Req 9.5).
- Output schema: `{ "matchedProfessionalId": string, "rationale": string }`
- Validation: `matchedProfessionalId` must be one of the supplied candidate IDs; otherwise unusable → retry.

**4. summarizePatient** (Req 10)
- Input: `{ description, professionalType, standardFields, answers }`
- Output schema: `{ "summary": string }`
- On failure: the professional-facing view still renders raw intake data (Req 10.5).

### Resilience wrapper (shared)

```
callAi(task):
  start timeout timer (configurable, e.g. 20s)
  response = provider.invoke(prompt)   // aborted on timeout → AiUnavailableError
  json = parseJsonOrThrow(response)
  validateSchema(json, task.schema)    // invalid → AiUnavailableError
  return json
```

- Keys are read from server-side environment only (Req 14.1).
- Only task-necessary fields are sent to the provider (Req 14.5) — e.g. matching sends service descriptions and intake data but not the client's identity beyond what's needed.
- AI text is stored and later rendered as inert text (Req 14.4).

---

## File Storage (Req 15)

Professional profile photos are stored in **Supabase Storage** (a public `avatars` bucket), not in the database — the DB keeps only the resulting public URL in `Professional.avatarUrl`.

- A server-side Supabase client is created with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service-role key kept server-side only, never exposed to the browser — Req 15.5).
- The upload route validates the file is an image (by MIME type), uploads it under a per-professional key (e.g. `avatars/<professionalId>`), `upsert: true` so a new upload replaces the old one (single current photo, Req 15.3), and reads back the public URL to persist.
- Display uses the stored URL directly; a neutral placeholder is shown when `avatarUrl` is null (Req 15.4).
- No admin approval / verification (Req 15.6).

### Reviews and ratings (Req 16)

A `Review` row is keyed uniquely by `appointmentId` (at most one per appointment). `getProfessionalRating(professionalId)` returns `{ average, count }` via a Prisma aggregate over that professional's reviews; callers show "No reviews yet" when count is 0 (Req 16.6). Reviews require the client to own an appointment with the professional (gate (a): any appointment qualifies; no `COMPLETED` state machine). No moderation workflow (Req 16.7).

---

## API Surface

All routes are Next.js route handlers under `app/api/**`. Auth required except sign-up and the Auth.js sign-in endpoint. Role guards noted per route.

### Auth (Req 1)
- `POST /api/auth/signup` — custom route handler; body includes role; if role=professional, `professionalType` required (Req 1.2). Creates the user + role profile and rejects duplicate email with a generic error (Req 1.3). Issues a single-use email verification token in the same transaction, sends the Resend email after commit, sets a short-lived signed HttpOnly `_verifySessionId` cookie (user id only), and redirects to `/verify-email-pending` (Req 17.1, 17.2).
- `GET/POST /api/verify-email?token=…` — consumes a valid, unexpired verification token: sets `User.emailVerified = true`, deletes the token, clears the `_verifySessionId` cookie, and redirects to `/signin?verified=true`; invalid/expired tokens return 400 (Req 17.4, 17.5). `GET` serves the emailed link (clicks are GET); `POST` shares the same logic.
- `GET /api/check-verification` / `POST /api/resend-verification` (unauthenticated) — identify the user solely from the signed `_verifySessionId` cookie; the first returns `{ emailVerified }` for the pending page's 5s poll, the second re-sends a fresh token/email. Both return a generic result when the cookie is missing/invalid (no enumeration) (Req 17.6, 17.7).
- **Email verification is NON-BLOCKING (Req 17.3):** login is handled by **Auth.js** Credentials at `/api/auth/*`; its `authorize()` does NOT check `emailVerified`, so users can sign in whether or not they have verified. Generic error on bad credentials (Req 1.4, 1.5); sign-out clears the session (Req 1.7). The verification issue/send/consume flow above still runs, but nothing gates access on it. (This was briefly a blocking gate; it was removed because the Resend sandbox sender only delivers to the account owner's address, which would otherwise lock out anyone signing up with a different email. Existing users had been backfilled to `emailVerified = true` during that period.)

### Professional (Req 2, 3, 4) — professional role
- `PUT /professionals/me/profile` — name, type, specialty, bio; validates required fields (Req 2.3, 2.4).
- `POST /professionals/me/services` / `PUT` / `DELETE /:id` — price validated as a whole-PKR integer ≥ 0 (Req 3.3); displayed as "Rs 5,000".
- `GET /professionals/me/services` — dashboard listing (Req 3.4).
- `POST /professionals/me/slots` — rejects overlap and past/invalid ranges (Req 4.2, 4.3).
- `DELETE /professionals/me/slots/:id` — only if unbooked (Req 4.5).
- `GET /professionals/me/schedule` — appointments against slots (Req 11.5).
- `POST /professionals/me/avatar` — multipart image upload; validates content-type is an image, uploads to the Supabase Storage `avatars` bucket (server-side key), stores the public URL in `Professional.avatarUrl`, replacing any prior photo (Req 15).

### Client intake pipeline (Req 5–10) — client role
- `POST /intakes` — create with description; validates min length (Req 5.2). → status DESCRIBED.
- `POST /intakes/:id/classify` — triggers AI classification (Req 6). → CLASSIFIED. Retryable.
- `GET /intakes/:id/field-schema` — returns the field set to render based on type (Req 7).
- `PUT /intakes/:id/standard-fields` — validates against type-specific schema (Req 7.4). → FIELDS_COLLECTED.
- `POST /intakes/:id/questions` — triggers AI question generation (Req 8). → QUESTIONS_READY. Retryable.
- `PUT /intakes/:id/answers` — persists answers (Req 8.7). → ANSWERED.
- `POST /intakes/:id/match` — filters candidates, calls AI match (Req 9), then generates the patient summary best-effort (see below). → MATCHED or "no match" (Req 9.5). Retryable. Response includes `summaryGenerated`.
- `GET /intakes/:id/match` — matched professional + rationale + available slots (Req 9.4, 11.1).
- `POST /intakes/:id/summary` — explicitly (re)generates and persists the AI patient summary from the intake (description + type + standard fields + answers) (Req 10.1). Retryable; best-effort (raw intake data remains available on failure, Req 10.5). Shares `generatePatientSummary()` with the match flow.

Summary generation timing: the summary is generated automatically at the match step so it is ready before booking (Req 10.1, 10.6). It runs *after* the match transaction commits and is best-effort — a summary failure is logged and does not roll back or block the match (Req 10.5); it can be regenerated via the summary route. Persisted summaries surface in the professional's medical-history view through the derived read-model (Req 13.3).

### Booking (Req 11) — client role
- `POST /appointments` — body `{ intakeId, timeSlotId }`. Transactionally re-checks slot availability; on conflict returns 409 and prompts re-selection (Req 11.3). Marks slot BOOKED and creates appointment (Req 11.2, 11.4). → intake BOOKED.

### Professional pre/post appointment (Req 10, 12, 13) — professional role, ownership-guarded
- `GET /appointments/:id/summary` — patient summary + underlying intake data; only the matched professional (Req 10.2–10.4).
- `GET /clients/:clientId/medical-history` — allowed only if the professional has a booked appointment with that client (Req 13.2, 13.5); chronological (Req 13.4).
- `POST /appointments/:id/session-record` / `PUT` — professional-entered diagnosis + plan; required fields validated; author-only edit (Req 12).
- `PATCH /appointments/:id` — professional sets the meeting link and/or payment status on their own appointment (Req 11.6, 11.7); both are shown to the client and professional.

### Client self-view (Req 13.6) — client role
- `GET /clients/me/medical-history` — client's full history.

### Reviews (Req 16) — client role
- `POST /appointments/:id/review` — client submits `{ rating (1..5), text? }` for an appointment they own; validates the rating range and one-review-per-appointment (upserts on repeat, Req 16.1–16.4). The professional is derived from the appointment.
- Rating aggregates (average + count) are computed server-side via a `getProfessionalRating(professionalId)` helper and shown on the professional's profile and in match/browse results (Req 16.5, 16.6). No dedicated GET route is required — aggregates are loaded alongside professional data in the pages/match candidates that display them.

---

## Health Metrics Calculator (Req 18)

A stateless, public health assessment tool accessible to authenticated professionals at `/health-calculator`.

### Design

- **Route:** `/health-calculator` (public, requires professional authentication)

- **Architecture:** Client-side React form + pure math module (no API calls, no DB storage)

- **Input validation:** Positive numbers required; waist/hip optional

- **Calculations module** (`src/lib/calculations.ts`):

  - BMR (Mifflin-St Jeor): separate formulas for male/female, accounts for age

  - TDEE: BMR × activity factor (Sedentary 1.2, Lightly active 1.375, Moderately active 1.55, Very active 1.725, Extremely active 1.9)

  - EER: equals TDEE

  - WHR: waist / hip, with thresholds for good/at-risk/high-risk by gender

  - WHtR: waist / height, with thresholds for healthy/overweight/obese

  - Body fat %: Deurenberg equation `BF% = 1.20×BMI + 0.23×age − 10.8×sex − 5.4`), clamped to 2–60%

  - FFMI / FMI: derived from body fat %, height, weight

- **Output:** Card-based display of all metrics with labels, values, and health categories

- **Data persistence:** None (stateless, calculations discarded on page reload)

- **UI state:** Form inputs + calculated results; reset button clears both

- **Disclaimer:** "These calculations are estimates. For personalized health advice, consult with a qualified healthcare professional."

This tool is reference-only for professionals; no client data is stored or linked to appointments.

---

## Key Flows

### Booking race condition (Req 11.3)

The slot booking must be atomic to prevent double-booking (Req 4.4, 11.3). Implemented as a DB transaction with a conditional update:

```
BEGIN
  UPDATE time_slot SET status = 'BOOKED'
    WHERE id = :slotId AND status = 'AVAILABLE'   -- conditional
  if rows_affected == 0:  ROLLBACK → 409 "slot no longer available"
  INSERT appointment (...)
  UPDATE intake SET status = 'BOOKED'
COMMIT
```

The conditional `WHERE status = 'AVAILABLE'` guarantees only one concurrent booking wins.

### Slot overlap prevention (Req 4.2)

Application-level check: before inserting a new slot, the service queries the professional's existing non-removed slots and compares time ranges in code. Two ranges overlap when `newStart < existingEnd AND newEnd > existingStart`. If any existing slot overlaps, the insert is rejected with a 409 conflict.

```
createSlot(professionalId, startsAt, endsAt):
  validate endsAt > startsAt and startsAt in the future   // Req 4.3
  existing = slots where professionalId = :professionalId and status != 'REMOVED'
  if any s in existing where startsAt < s.endsAt and endsAt > s.startsAt:
      reject → 409 conflict                                // Req 4.2
  insert slot (status = AVAILABLE)
```

This keeps the schema simple (no database exclusion constraint). The check is adequate for the expected single-professional edit pattern, where a professional edits their own availability sequentially.

### Medical history access control (Req 13.5)

`GET /clients/:clientId/medical-history` authorizes only if:
- the requester is that client (self), OR
- the requester is a professional with at least one `Appointment` referencing that `clientProfileId`.

Otherwise 403. The read-model then aggregates intakes, summaries, and session records across all professionals/types (Req 13.3) in chronological order.

---

## Error Handling

| Condition | HTTP | Behavior |
|---|---|---|
| Validation failure (fields, price, slot range) | 400 | Field-level messages (Req 2.3, 3.3, 4.3, 7.4, 12.5) |
| Auth failure | 401 | Generic message (Req 1.5) |
| Duplicate email | 409 | Generic "cannot register with these details" (Req 1.3) |
| Forbidden (role/ownership) | 403 | No resource detail leaked (Req 1.6, 12.6, 13.5) |
| Slot taken during booking | 409 | Prompt to choose another slot (Req 11.3) |
| Slot overlap on create | 409 | Conflict error (Req 4.2) |
| AI timeout/malformed/out-of-range | 503 (retryable) | `{ error, retryable: true }`; UI shows retry, preserves input (Req 6.3, 8.6, 9.6, 10.5, 14.2, 14.3) |
| No match candidates | 200 | `{ match: null, reason: "no_match_available" }` (Req 9.5) |

AI-dependent endpoints return a distinct retryable error shape so the frontend can show a retry affordance while keeping the client's prior input in local state.

---

## Frontend (React) Structure

- **Client intake wizard** (fully wired in Phase 10): A multi-step component driven by `Intake.status`, so a returning client resumes at the right step. Steps: Describe → (classifying spinner, Req 6.5) → Standard fields (type-specific form, Req 7) → (generating spinner, Req 8.8) → Answer questions → (matching spinner) → Match result + slot picker → Confirmation. AI steps (classify, generate questions, match) fire automatically with a spinner and, on failure, a retry control; because intake state is persisted server-side, retry never loses prior input (Req 6.5, 8.6, 9.6). The final step is the AI match-result view (matched professional + rationale + available slots) and booking passes `intakeId` so the intake advances to BOOKED. This replaced the temporary Phase 4.4 browse/book UI (`/client/browse` now redirects to `/client/intake`). The four temporary `/api/ai-test/*` verification routes from Phase 8 were removed.
- **Professional dashboard**: Profile editor (with type), services CRUD, slots calendar, schedule, and per-appointment views for the patient summary + medical history (pre-appointment) and session-record form (post-appointment).
- **Client profile**: Read-only medical history timeline (Req 13.6).
- **Loading/error states**: Every AI step renders an in-progress indicator and a retry control on failure, preserving entered data.

---

## Security & Privacy Notes

- Passwords hashed with argon2/bcrypt; never returned by any endpoint.
- AI keys server-side only; the browser never calls the provider directly (Req 14.1).
- Health data is sensitive: medical-history and summary endpoints are strictly ownership/appointment-gated (Req 10.4, 13.5), and only task-necessary data is sent to the AI provider (Req 14.5).
- All AI-produced and client-produced free text is rendered as inert text to avoid injection (Req 14.4).
- Supabase Storage service-role key is server-side only; the browser never receives it, and avatar uploads go through a server route (Req 15.5). Uploaded files are validated as images before storage.

---

## Correctness Properties

Key invariants the implementation must uphold:

- **No double-booking.** A time slot can back at most one active appointment. Enforced by the conditional `UPDATE ... WHERE status = 'AVAILABLE'` inside a transaction plus the unique constraint on `Appointment.timeSlotId` (Req 4.4, 11.3).
- **No overlapping slots.** A professional's non-removed slots never overlap; enforced by the application-level overlap check on create (Req 4.2).
- **Type-consistent matching.** Match candidates are always of the identified professional type and have at least one active service and one available future slot; the AI can only return an id from the supplied candidate set (Req 9.2, 9.3, 9.4).
- **Booked slots are immutable to removal.** A slot in `BOOKED` state cannot be removed (Req 4.5).
- **Medical-history access control.** History is readable only by the owning client or a professional with a booked appointment for that client (Req 13.5).
- **Session-record authorship.** Only the professional who authored a session record may edit it (Req 12.6).
- **AI output is validated.** Every AI response is schema-validated before use; malformed/timed-out/out-of-range responses become retryable errors and never corrupt persisted state (Req 14.2, 14.3).
- **Summary is non-blocking.** A patient-summary generation failure never blocks or rolls back a match (Req 10.5).
- **Intake progression is monotonic.** The intake advances through its status states in order; each AI step is retryable without losing prior input.

## Testing Strategy

This is a time-constrained build; automated test suites are out of scope. Correctness is verified through:

- **Type checking + build.** `npm run build` runs the TypeScript compiler across the whole app; a green build is a gate for every change.
- **Per-phase functional verification against real services.** Each phase's core logic is exercised against the live Supabase database and the live Gemini API via short throwaway scripts and temporary test routes (e.g. `/api/ai-test/*`). Verified behaviors include: signup/role persistence, duplicate-email handling, slot overlap/boundary and booked-removal rules, the concurrent double-booking race (one success, one 409, one appointment), session-record author guard, medical-history aggregation and access matrix, intake validation, and all four AI calls returning valid structured output.
- **Manual end-to-end walkthroughs.** Full user journeys are exercised in the browser (sign up, profile/services/slots, booking, intake-to-match, post-appointment records).
- **Temporary diagnostics are removed** once a capability is confirmed (the `/api/ai-test/*` routes are removed in Phase 10).

## Requirements Traceability

| Requirement | Primary design coverage |
|---|---|
| 1 Auth & roles | User model, /auth routes, RBAC guards |
| 2 Professional profile | Professional model, PUT profile, type constraint |
| 3 Services | Service model (typed), services CRUD, price validation |
| 4 Time slots | TimeSlot model, application-level overlap check, slot routes |
| 5 Intake description | Intake model (DESCRIBED), POST /intakes |
| 6 Type classification | classifyProfessionalType, CLASSIFIED, retry |
| 7 Type-specific fields | standardFields JSON + type schemas |
| 8 Follow-up questions | generateFollowUpQuestions, clamping, steering |
| 9 Matching | candidate pre-filter + matchProfessional |
| 10 Patient summary | summarizePatient, PatientSummary, pre-appt view |
| 11 Booking | Appointment model, transactional booking |
| 12 Session record | SessionRecord model, author-only edit |
| 13 Medical history | Derived read-model + access control |
| 14 AI reliability/safety | AiClient wrapper, timeouts, schema validation |
| 15 Profile picture | Professional.avatarUrl, Supabase Storage, avatar upload route |
| 16 Reviews & ratings | Review model, review route, getProfessionalRating aggregate |

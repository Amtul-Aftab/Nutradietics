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

## Data Model

Relational schema (PostgreSQL). Types shown in Prisma-like syntax for clarity.

### Enums

```prisma
enum Role            { CLIENT  PROFESSIONAL }
enum ProfessionalType{ NUTRITIONIST  FITNESS_TRAINER }
enum Gender          { MALE  FEMALE  OTHER  UNSPECIFIED }
enum IntakeStatus    { DESCRIBED  CLASSIFIED  FIELDS_COLLECTED  QUESTIONS_READY  ANSWERED  MATCHED  BOOKED }
enum SlotStatus      { AVAILABLE  BOOKED  REMOVED }
enum AppointmentStatus { CONFIRMED  COMPLETED  CANCELLED }
```

### Core tables

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role
  createdAt    DateTime @default(now())

  professional Professional?   // set when role = PROFESSIONAL
  clientProfile ClientProfile? // set when role = CLIENT
}

model Professional {
  id        String           @id @default(uuid())
  userId    String           @unique
  user      User             @relation(fields: [userId], references: [id])
  name      String
  type      ProfessionalType            // Req 1.2, 2.4
  specialty String
  bio       String?
  services  Service[]
  slots     TimeSlot[]
  appointments Appointment[]
}

model ClientProfile {
  id       String   @id @default(uuid())
  userId   String   @unique
  user     User     @relation(fields: [userId], references: [id])
  name     String?
  intakes  Intake[]
  appointments Appointment[]
  // medical history is derived from intakes + summaries + session records
}

model Service {
  id             String           @id @default(uuid())
  professionalId String
  professional   Professional     @relation(fields: [professionalId], references: [id])
  type           ProfessionalType // denormalized from professional for match filtering (Req 3.1)
  specialty      String
  description    String
  priceCents     Int              // integer cents; validated >= 0 (Req 3.3)
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

## API Surface

All routes are Next.js route handlers under `app/api/**`. Auth required except sign-up and the Auth.js sign-in endpoint. Role guards noted per route.

### Auth (Req 1)
- `POST /api/auth/signup` — custom route handler; body includes role; if role=professional, `professionalType` required (Req 1.2). Creates the user + role profile and rejects duplicate email with a generic error (Req 1.3).
- Login and logout are handled by **Auth.js** at its standard `/api/auth/*` endpoints (Credentials sign-in returns a generic error on failure — Req 1.4, 1.5; sign-out clears the session — Req 1.7). No custom login/logout handlers are needed.

### Professional (Req 2, 3, 4) — professional role
- `PUT /professionals/me/profile` — name, type, specialty, bio; validates required fields (Req 2.3, 2.4).
- `POST /professionals/me/services` / `PUT` / `DELETE /:id` — price validated ≥ 0 integer cents (Req 3.3).
- `GET /professionals/me/services` — dashboard listing (Req 3.4).
- `POST /professionals/me/slots` — rejects overlap and past/invalid ranges (Req 4.2, 4.3).
- `DELETE /professionals/me/slots/:id` — only if unbooked (Req 4.5).
- `GET /professionals/me/schedule` — appointments against slots (Req 11.5).

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

### Client self-view (Req 13.6) — client role
- `GET /clients/me/medical-history` — client's full history.

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

- **Client intake wizard**: A multi-step component driven by `Intake.status`, so a returning client resumes at the right step. Steps: Describe → (classifying spinner, Req 6.5) → Standard fields (type-specific form, Req 7) → (generating spinner, Req 8.8) → Answer questions → (matching spinner) → Match result + slot picker → Confirmation.
- **Professional dashboard**: Profile editor (with type), services CRUD, slots calendar, schedule, and per-appointment views for the patient summary + medical history (pre-appointment) and session-record form (post-appointment).
- **Client profile**: Read-only medical history timeline (Req 13.6).
- **Loading/error states**: Every AI step renders an in-progress indicator and a retry control on failure, preserving entered data.

---

## Security & Privacy Notes

- Passwords hashed with argon2/bcrypt; never returned by any endpoint.
- AI keys server-side only; the browser never calls the provider directly (Req 14.1).
- Health data is sensitive: medical-history and summary endpoints are strictly ownership/appointment-gated (Req 10.4, 13.5), and only task-necessary data is sent to the AI provider (Req 14.5).
- All AI-produced and client-produced free text is rendered as inert text to avoid injection (Req 14.4).

---

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

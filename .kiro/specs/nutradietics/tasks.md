# Implementation Plan

## Overview

Ordered checklist derived from `design.md`. Build the core marketplace end-to-end first, then layer the AI intake pipeline (each of the four AI calls independently, then wired into the full flow), then deployment.

Each task is scoped to be completable in a single sitting. Requirement references point back to `requirements.md`.

## Task Dependency Graph

Phases are executed in order; each phase depends on the ones before it. The graph below shows the primary dependencies.

```
Phase 0 (Project Setup)
   │
   ▼
Phase 1 (Auth & Roles)
   │
   ├──────────────┐
   ▼              ▼
Phase 2          Phase 5 (Session Records & Medical History)
(Profile &        depends on Phase 4 (needs appointments)
 Services)
   │
   ▼
Phase 3 (Time Slots)
   │
   ▼
Phase 4 (Booking End-to-End)  ── completes the no-AI core marketplace
   │
   ▼
Phase 5 (Session Records & Medical History)
   │
   ▼
Phase 6 (AI Adapter Foundation)
   │
   ▼
Phase 7 (Intake Foundation)
   │
   ▼
Phase 8 (The Four AI Calls: 8A, 8B, 8C, 8D — each built/verified independently)
   │
   ▼
Phase 9 (Wire Summary into Medical History)  ── depends on Phase 5 + Phase 8D
   │
   ▼
Phase 10 (Full Intake Flow Wiring)  ── depends on Phases 6–9; replaces Phase 4.4 UI
   │
   ▼
Phase 11 (Deployment Setup)
```

Key cross-phase dependencies:
- Phase 5 depends on Phase 4 (session records attach to appointments).
- Phase 8 depends on Phase 6 (AI adapter) and Phase 7 (intake foundation).
- Phase 9 depends on Phase 5 (medical-history timeline) and Phase 8D (patient summary).
- Phase 10 depends on Phases 6–9 and replaces the temporary browse/book UI from Phase 4.4.

## Tasks

### Phase 0: Project Setup

- [x] 0.1 Initialize the Next.js (TypeScript) app in the repo root, with the App Router and a basic health-check page to confirm it runs.
- [x] 0.2 Add and configure Prisma; create the initial `schema.prisma` with the datasource pointing at PostgreSQL via `DATABASE_URL`.
- [x] 0.3 Define all enums and models from the design's data model (`User`, `Professional`, `ClientProfile`, `Service`, `TimeSlot`, `Intake`, `FollowUpQuestion`, `Match`, `PatientSummary`, `Appointment`, `SessionRecord`) in `schema.prisma`, run the first migration, and generate the Prisma client.
- [x] 0.4 Add a shared Prisma client singleton and confirm the app can connect to a local database.
- [x] 0.5 Set up a base layout, shared UI primitives (button, input, form field, spinner, error banner), and a simple app-wide error/loading convention.

### Phase 1: Authentication & Roles (Req 1)

- [x] 1.1 Install and configure Auth.js (NextAuth) with the Credentials provider and a route handler at `app/api/auth/[...nextauth]`.
- [x] 1.2 Implement password hashing (argon2/bcrypt) helpers for creating and verifying credentials (Req 1.4, 1.5).
- [x] 1.3 Build the custom `POST /api/auth/signup` route: create `User` plus the matching `Professional` or `ClientProfile`; require `professionalType` when role is professional; reject duplicate email with a generic error (Req 1.2, 1.3).
- [x] 1.4 Configure Auth.js session/JWT callbacks to include `userId`, `role`, and (for professionals) `professionalType` (Req 1.6).
- [x] 1.5 Add a `getSession`/`requireRole` server helper and route-protection middleware; return 401 for unauthenticated and 403 for wrong-role access (Req 1.6, 1.7).
- [x] 1.6 Build sign-up, sign-in, and sign-out UI wired to Auth.js; redirect authenticated users to the correct dashboard by role.

### Phase 2: Professional Profile & Services (Req 2, 3)

- [x] 2.1 Build `PUT /professionals/me/profile` to create/update name, professional type, specialty, bio; validate required fields and constrain type to the two allowed values (Req 2.1–2.4).
- [x] 2.2 Build the professional profile editor UI, including the professional-type selector.
- [x] 2.3 Build service CRUD routes: `POST/PUT/DELETE /professionals/me/services`; validate price as a non-negative integer (cents) and denormalize the professional's type onto each service (Req 3.1–3.3).
- [x] 2.4 Build `GET /professionals/me/services` and the dashboard listing of active services (Req 3.4).
- [x] 2.5 Build the services management UI (create/edit/remove) with price validation feedback.

### Phase 3: Time Slots (Req 4)

- [x] 3.1 Implement the slot service with validation: `endsAt > startsAt`, `startsAt` in the future, and the application-level overlap check against the professional's existing non-removed slots (Req 4.2, 4.3).
- [x] 3.2 Build `POST /professionals/me/slots` and `DELETE /professionals/me/slots/:id` (delete only when unbooked), returning 409 on overlap (Req 4.1, 4.2, 4.5).
- [x] 3.3 Build the availability management UI (add/remove slots) showing available vs booked state.

### Phase 4: Booking End-to-End (Req 11)

> At the end of this phase the core marketplace works without any AI: a professional can be found by ID, their available slots viewed, and an appointment booked.

- [x] 4.1 Implement the transactional booking service: conditional `UPDATE time_slot ... WHERE status = 'AVAILABLE'` inside a Prisma transaction; create the `Appointment` and mark the slot booked; roll back to a 409 on conflict (Req 4.4, 11.2, 11.3).
- [x] 4.2 Build `POST /appointments` (body `{ professionalId | intakeId, timeSlotId }`) with ownership/role guards; return confirmation on success (Req 11.2, 11.4).

  > Note: at this phase, book directly against a professional; the `intakeId` linkage is added in Phase 10.
- [x] 4.3 Build `GET /professionals/me/schedule` and the professional schedule UI showing appointments against slots (Req 11.5).
- [x] 4.4 Build a temporary "browse professionals + view available slots + book" client UI to exercise the full booking flow end-to-end (this is replaced by the AI match result view in Phase 10).
- [x] 4.5 Manually verify the end-to-end core flow: sign up as professional, add profile/service/slots; sign up as client, book a slot; confirm double-booking is rejected.

### Phase 5: Session Records & Medical History (Req 12, 13)

- [x] 5.1 Build `POST/PUT /appointments/:id/session-record`: professional-entered diagnosis + plan, required-field validation, author-only edit guard (Req 12.1–12.6).
- [x] 5.2 Build the post-appointment session-record form UI on the professional's appointment view.
- [x] 5.3 Implement the medical-history read-model service that aggregates a client's intakes, patient summaries, and session records in chronological order (Req 13.1, 13.3, 13.4).
- [x] 5.4 Build `GET /clients/:clientId/medical-history` with access control (self, or a professional with a booked appointment with that client) and `GET /clients/me/medical-history` (Req 13.2, 13.5, 13.6).
- [x] 5.5 Build the medical-history timeline UI for both the professional (pre-appointment view) and the client (self-view).

  > Patient-summary entries will appear here once Phase 9 is built; session records and intakes are available now.

### Phase 6: AI Adapter Foundation (Req 14)

- [ ] 6.1 Define the `AiClient` interface with the four method signatures (classify, generateQuestions, match, summarize) and their input/output types.
- [ ] 6.2 Implement the provider adapter reading the API key from server-side env only, plus the shared resilience wrapper: configurable timeout → abort, JSON parse, and schema validation, throwing a typed `AiUnavailableError` (Req 14.1, 14.2, 14.3).
- [ ] 6.3 Add JSON-schema validators for each of the four response shapes and a shared mapping from `AiUnavailableError` to the retryable 503 error response (Req 14.3).
- [ ] 6.4 Add a data-minimization helper so each AI call sends only task-necessary fields (Req 14.5), and ensure stored AI text is treated as inert on render (Req 14.4).

### Phase 7: Intake Foundation (Req 5)

- [ ] 7.1 Build `POST /intakes` to create an intake from a plain-language description with minimum-length validation; set status `DESCRIBED` (Req 5.1, 5.2, 5.3).
- [ ] 7.2 Build the intake-wizard shell UI driven by `Intake.status` (resumable), starting with the description step.

### Phase 8: The Four AI Calls (each built and verified independently)

> Build and manually verify each AI call in isolation (e.g. via its own route + a scratch trigger) before Phase 10 wires them into the wizard.

#### 8A. Classify professional type (Req 6)
- [ ] 8A.1 Implement `AiClient.classifyProfessionalType` with prompt + strict output validation (exactly one of the two types) (Req 6.1, 6.4).
- [ ] 8A.2 Build `POST /intakes/:id/classify`: call the classifier, persist `professionalType`, set status `CLASSIFIED`; map failures/out-of-range to a retryable error (Req 6.2, 6.3).
- [ ] 8A.3 Verify independently: given sample descriptions, confirm correct type classification and that failures return a retryable response without losing the description.

#### 8B. Generate follow-up questions (Req 7, 8)
- [ ] 8B.1 Implement the type-specific standard-field schema + validation (nutritionist superset incl. `currentSymptoms`/`recentReports`; trainer subset that rejects those fields; `recentReports` free-text only) (Req 7.1–7.5).
- [ ] 8B.2 Build `GET /intakes/:id/field-schema` and `PUT /intakes/:id/standard-fields`; set status `FIELDS_COLLECTED` (Req 7).
- [ ] 8B.3 Implement `AiClient.generateFollowUpQuestions` with type-based prompt steering (diet vs exercise/injury) and 3–5 clamping (>5 truncate, <3 retry) (Req 8.1–8.3, 8.5).
- [ ] 8B.4 Build `POST /intakes/:id/questions` (persist questions, status `QUESTIONS_READY`) and `PUT /intakes/:id/answers` (persist answers, status `ANSWERED`) (Req 8.4, 8.7).
- [ ] 8B.5 Verify independently: for each type, confirm 3–5 appropriately themed questions and correct clamping/retry behavior.

#### 8C. Match professional (Req 9)
- [ ] 8C.1 Implement candidate pre-filtering: professionals whose type matches the identified type AND with ≥1 active service AND ≥1 available slot; short-circuit to "no match" when empty (Req 9.2, 9.3, 9.5).
- [ ] 8C.2 Implement `AiClient.matchProfessional` with output validation that `matchedProfessionalId` is one of the supplied candidates (Req 9.1, 9.4).
- [ ] 8C.3 Build `POST /intakes/:id/match` (persist `Match` incl. rationale, status `MATCHED`) and `GET /intakes/:id/match`; map failures to retryable, empty candidates to the no-match response (Req 9.4–9.7).
- [ ] 8C.4 Verify independently: with seeded professionals, confirm correct filtering, a valid matched ID + rationale, and the no-match path.

#### 8D. Summarize patient (Req 10)
- [ ] 8D.1 Implement `AiClient.summarizePatient` combining description, standard fields, and answers (Req 10.1).
- [ ] 8D.2 Persist the `PatientSummary` and build `GET /appointments/:id/summary` returning the summary plus underlying intake data, restricted to the matched professional (Req 10.2–10.4, 10.6).
- [ ] 8D.3 Ensure the summary view falls back to raw intake data when generation fails, with a regenerate option (Req 10.5).
- [ ] 8D.4 Verify independently: given a completed intake, confirm a coherent summary is generated, persisted, and visible only to the matched professional.

### Phase 9: Wire Summary into Medical History (Req 10.6, 13)

- [ ] 9.1 Generate the patient summary at the match step (`ANSWERED → MATCHED`) so it is ready before booking, and confirm summaries now surface in the medical-history timeline from Phase 5 (Req 10.1, 10.6, 13.3).

### Phase 10: Full Intake Flow Wiring (Req 5–11)

> Connect the independently built pieces into one resumable client journey.

- [ ] 10.1 Wire the intake wizard through all steps driven by `Intake.status`: Describe → classify → standard fields → questions → answers → match → slot picker → confirm, each with in-progress indicators and retry-preserving-input on AI failure (Req 6.5, 8.6, 8.8, 9.6).
- [ ] 10.2 Link booking to the intake: `POST /appointments` uses `intakeId`, sets intake status `BOOKED`, and creates the appointment tied to the matched professional (Req 11.2).
- [ ] 10.3 Replace the temporary browse/book UI (Phase 4.4) with the AI match-result view: matched professional details + rationale + available slots (Req 9.4, 11.1).
- [ ] 10.4 Manually verify the complete journey end-to-end: description → classification → type-specific fields → follow-up questions → match → booking → professional sees summary + history → professional records diagnosis/plan → entry appears in the client's medical history.

### Phase 11: Deployment Setup

- [ ] 11.1 Document and configure all environment variables (`DATABASE_URL`, Auth.js secret/URL, AI provider key, AI timeout) with a `.env.example`; confirm none are exposed to the client bundle.
- [ ] 11.2 Provision the production PostgreSQL database and run Prisma migrations against it; verify connectivity from the deploy target.
- [ ] 11.3 Configure the single-app host (build command, start command, env vars, Node version) and deploy the Next.js app.
- [ ] 11.4 Post-deploy smoke test: sign-up (both roles), profile/service/slot creation, a full AI intake-to-booking journey, and the post-appointment diagnosis + medical-history flow against the deployed environment.

## Notes

- **Sequencing rationale.** The core marketplace (Phases 0–5) is built and verified end-to-end before any AI work begins. The four AI calls (Phase 8) are each implemented and verified in isolation before Phase 10 wires them into a single resumable client journey.
- **Temporary scaffolding.** The browse/book client UI from task 4.4 is intentionally temporary; task 10.3 replaces it with the AI match-result view.
- **Schema evolution.** `Appointment.intakeId` was made nullable during Phase 4 so direct (pre-intake) bookings work before the intake flow exists; task 10.2 wires the `intakeId` linkage.
- **AI safety.** All AI calls run server-side only, with keys never exposed to the client, timeouts, and response-schema validation (Phase 6, Req 14).
- **Requirement traceability.** Each task cites the `requirements.md` items it satisfies; the design coverage is summarized in the traceability table in `design.md`.
- **Verification.** Tasks marked "verify independently" or "manually verify" call for functional confirmation (against the real database / AI provider) beyond a passing build.

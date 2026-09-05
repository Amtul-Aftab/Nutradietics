# Nutradietics — Requirements

## Introduction

Nutradietics is a freelance-style marketplace that connects health professionals with clients seeking their services. The platform supports exactly two types of health professionals: **nutritionists** and **fitness trainers**. Professionals list their services and availability. Clients describe their needs in plain language; AI first determines which professional type fits best (exactly one of nutritionist or fitness trainer), collects type-specific standard intake fields, asks type-adapted follow-up questions, and matches the client to a specific professional of the identified type. The client then books an available time slot to confirm an appointment.

Before each appointment, the matched professional can view an AI-generated patient summary plus the client's ongoing medical history. After each appointment, the professional records their own diagnosis/assessment and recommended plan. The original intake, the AI-generated summary, and the professional's diagnosis/solution from every session are saved to the client's profile as their ongoing medical history, giving future professionals (of either type) continuity of care.

The AI-driven professional-type classification, follow-up question generation, professional matching, and patient summary are powered by real AI API calls, not hardcoded rules. The professional's diagnosis/solution is entered by the professional and is NOT AI-generated.

### Terminology
- **Professional**: A health professional on the platform, of type nutritionist or fitness trainer.
- **Professional type**: One of exactly two values — nutritionist or fitness trainer.
- **Client**: A user seeking help from a professional.
- **Service**: A listing created by a professional (specialty, description, price, time slots).
- **Time slot**: A discrete, bookable window of availability.
- **Standard intake fields**: A fixed set of structured health fields collected from the client, differing by identified professional type.
- **Intake**: The client's plain-language need, standard intake fields, and answers to AI follow-up questions.
- **Patient summary**: An AI-generated summary combining the intake, standard fields, and follow-up responses, shown to the matched professional before the appointment.
- **Session record**: The diagnosis/assessment and recommended plan a professional enters after an appointment.
- **Medical history**: The client's accumulated intakes, patient summaries, and session records across all appointments, viewable by professionals for continuity of care.
- **Match**: An AI-produced selection of a professional of the identified type against a client's intake.

---

## Requirement 1: Account Registration and Authentication

**User Story:** As a new user, I want to sign up and sign in as either a professional or a client, so that I can access the features relevant to my role.

#### Acceptance Criteria
1. WHEN a visitor submits the sign-up form with a valid email, password, and selected role (professional or client) THEN the system SHALL create an account with that role and establish an authenticated session.
2. WHEN a visitor signs up as a professional THEN the system SHALL require them to select a professional type of exactly one of nutritionist or fitness trainer, and SHALL persist that type on their account.
3. IF the email is already registered THEN the system SHALL reject the sign-up and return a clear error without revealing whether the password was correct.
4. WHEN a user submits valid credentials on the sign-in form THEN the system SHALL authenticate them and start a session scoped to their role.
5. IF credentials are invalid THEN the system SHALL reject the attempt and return a generic authentication error.
6. WHEN a user is authenticated THEN the system SHALL restrict role-specific actions so that clients cannot access professional-only features and vice versa.
7. WHEN a user signs out THEN the system SHALL terminate the session and require re-authentication for protected routes.

---

## Requirement 2: Professional Profile Management

**User Story:** As a professional, I want to create and edit my profile, so that clients can understand my background and credentials.

#### Acceptance Criteria
1. WHEN an authenticated professional saves a profile with name, professional type, specialty, and bio THEN the system SHALL persist the profile and associate it with their account.
2. WHEN a professional updates any profile field THEN the system SHALL persist the change and reflect it on subsequent profile views.
3. IF a required profile field (name, professional type, or specialty) is missing THEN the system SHALL prevent saving and indicate which fields are required.
4. WHERE a professional type is set THEN the system SHALL constrain it to exactly one of nutritionist or fitness trainer.
5. WHEN a client views a matched professional THEN the system SHALL display the professional's profile details, including their professional type.

---

## Requirement 3: Service Listing Management

**User Story:** As a professional, I want to list the services I offer with pricing and details, so that clients know what I provide and at what cost.

#### Acceptance Criteria
1. WHEN a professional creates a service with specialty, description, and price THEN the system SHALL persist the service, associate it with their account, and associate it with the professional's type.
2. WHEN a professional edits or removes a service THEN the system SHALL update or remove the listing accordingly.
3. IF the price is missing, non-numeric, or negative THEN the system SHALL reject the listing and return a validation error.
4. WHEN a professional views their dashboard THEN the system SHALL display all of their active service listings.
5. WHERE a professional has no active services THEN the system SHALL exclude that professional from client matching results.

---

## Requirement 4: Availability and Time Slot Management

**User Story:** As a professional, I want to publish available time slots, so that clients can book appointments when I am free.

#### Acceptance Criteria
1. WHEN a professional adds a time slot with a start and end time THEN the system SHALL persist it as an available, bookable slot.
2. IF a new time slot overlaps an existing slot for the same professional THEN the system SHALL reject it and return a conflict error.
3. IF a time slot's start time is in the past or its end time is not after its start time THEN the system SHALL reject the slot.
4. WHEN a slot is booked by a client THEN the system SHALL mark that slot as unavailable so it cannot be double-booked.
5. WHEN a professional removes an unbooked slot THEN the system SHALL delete it from availability.

---

## Requirement 5: Client Needs Intake (Plain Language)

**User Story:** As a client, I want to describe what I need help with in my own words, so that the platform can understand my goals.

#### Acceptance Criteria
1. WHEN an authenticated client submits a free-text description of their needs THEN the system SHALL persist it and start an intake session.
2. IF the description is empty or below a minimum length THEN the system SHALL prompt the client to provide more detail before proceeding.
3. WHEN a client's intake is created THEN the system SHALL associate it with the client's account for later matching, summary generation, and medical history.

---

## Requirement 6: AI-Powered Professional Type Classification

**User Story:** As a client, I want the platform to determine which type of professional fits my needs, so that I am guided toward the right kind of help.

#### Acceptance Criteria
1. WHEN a client submits their plain-language description THEN the system SHALL call a real AI API to classify the best-fit professional type as exactly one of nutritionist or fitness trainer.
2. WHEN the AI classifies the professional type THEN the system SHALL use that classification to select which standard intake fields to collect and to adapt follow-up questions.
3. IF the AI classification call fails, times out, or returns an unusable response THEN the system SHALL surface a clear error and allow the client to retry without losing their original description.
4. IF the AI returns a value outside the allowed set (nutritionist or fitness trainer) THEN the system SHALL treat the response as unusable and follow the retry behavior.
5. WHILE waiting for the classification response THEN the system SHALL indicate that the platform is determining the best-fit professional type.

---

## Requirement 7: Type-Specific Standard Intake Fields

**User Story:** As a client, I want to provide standard health information appropriate to the type of professional I need, so that the professional and the matching process have accurate baseline data.

#### Acceptance Criteria
1. WHERE the identified professional type is nutritionist THEN the system SHALL collect these standard intake fields: age, weight, height, gender, activity level, medical conditions, medical history, allergies, current symptoms or signs, and brief text summaries of any medical tests/reports from the past 6 months.
2. WHERE the identified professional type is fitness trainer THEN the system SHALL collect these standard intake fields: age, weight, height, gender, activity level, medical conditions, medical history, and allergies — and SHALL NOT collect current symptoms/signs or the past-6-months medical test/report summaries.
3. WHEN the system collects the past-6-months medical test/report summaries THEN it SHALL accept brief free text only and SHALL NOT require or accept file uploads.
4. IF a required standard intake field for the applicable field set is missing or invalid (e.g. non-numeric age, weight, or height) THEN the system SHALL prevent submission and indicate which fields need correction.
5. WHEN the client submits the standard intake fields THEN the system SHALL persist them as part of the intake.

---

## Requirement 8: AI-Generated, Type-Adapted Follow-Up Questions

**User Story:** As a client, I want targeted follow-up questions that fit the type of professional I need, so that my specific situation is understood before matching.

#### Acceptance Criteria
1. WHEN the client has provided the standard intake fields THEN the system SHALL call a real AI API to generate between 3 and 5 follow-up questions tailored to the client's description and the identified professional type.
2. WHERE the identified professional type is nutritionist THEN the system SHALL instruct the AI to lean toward diet-related questions (e.g. eating patterns, dietary restrictions, nutrition goals).
3. WHERE the identified professional type is fitness trainer THEN the system SHALL instruct the AI to lean toward exercise-history and injury-related questions (e.g. training background, prior injuries, physical limitations).
4. WHEN the AI returns follow-up questions THEN the system SHALL present them to the client to answer.
5. IF the AI returns fewer than 3 or more than 5 questions THEN the system SHALL constrain the presented set to between 3 and 5 questions.
6. IF the AI API call fails, times out, or returns an unusable response THEN the system SHALL surface a clear error and allow the client to retry without losing prior input.
7. WHEN the client submits answers to the follow-up questions THEN the system SHALL persist the answers as part of the intake.
8. WHILE waiting for the AI response THEN the system SHALL indicate that questions are being generated.

---

## Requirement 9: AI-Powered Professional Matching

**User Story:** As a client, I want to be matched to the best-fit professional of the identified type based on my intake, so that I get help suited to my specific needs.

#### Acceptance Criteria
1. WHEN a client completes their follow-up answers THEN the system SHALL call a real AI API, providing the client's description, standard intake fields, follow-up answers, and the available professionals' service listings, to produce a best-fit match.
2. WHERE a professional type has been identified THEN the system SHALL restrict matching candidates to professionals whose type matches the identified type.
3. WHERE candidates are considered THEN the system SHALL further restrict them to professionals with at least one active service and at least one available time slot.
4. WHEN the AI returns a match THEN the system SHALL present the matched professional along with a rationale for why they were selected.
5. IF no professional meets the matching criteria THEN the system SHALL inform the client that no match is currently available.
6. IF the AI matching call fails, times out, or returns an unusable response THEN the system SHALL surface a clear error and allow the client to retry.
7. WHEN matching completes THEN the system SHALL persist the match result and its association with the client's intake.

---

## Requirement 10: AI-Generated Patient Summary for the Professional

**User Story:** As a matched professional, I want to see an AI-generated summary of the client before the appointment, so that I understand their problem quickly and avoid a cold start.

#### Acceptance Criteria
1. WHEN a client's intake is complete (description, standard fields, and follow-up answers) THEN the system SHALL call a real AI API to generate a patient summary combining those inputs.
2. WHEN an appointment has been booked THEN the system SHALL make the patient summary visible to the matched professional before the appointment.
3. WHERE a professional views the patient summary THEN the system SHALL also present the underlying intake data (standard fields and follow-up answers) it was derived from.
4. WHERE a patient summary is shown THEN the system SHALL restrict its visibility to the matched professional for that appointment and SHALL NOT expose it to other professionals except through the client's medical history.
5. IF the AI summary call fails, times out, or returns an unusable response THEN the system SHALL surface a clear error and allow regeneration, and SHALL still make the raw intake data available to the professional.
6. WHEN the AI returns a summary THEN the system SHALL persist it as part of the client's medical history.

---

## Requirement 11: Appointment Booking and Confirmation

**User Story:** As a client, I want to view my matched professional's available time slots and book one, so that I can confirm an appointment.

#### Acceptance Criteria
1. WHEN a client views a matched professional THEN the system SHALL display that professional's currently available (unbooked) time slots.
2. WHEN a client selects an available slot and confirms THEN the system SHALL create an appointment and mark the slot as unavailable.
3. IF the selected slot was booked by another client before confirmation THEN the system SHALL reject the booking and prompt the client to choose another slot.
4. WHEN an appointment is confirmed THEN the system SHALL record it for both the client and the professional and display a confirmation to the client.
5. WHEN a professional views their schedule THEN the system SHALL display appointments booked against their slots.

---

## Requirement 12: Post-Appointment Diagnosis and Plan Entry

**User Story:** As a professional, I want to enter my diagnosis/assessment and recommended plan after an appointment, so that the client has a clear record of my professional guidance.

#### Acceptance Criteria
1. WHEN a professional opens a completed appointment THEN the system SHALL provide a form for entering a diagnosis/assessment and a recommended solution/plan as free text.
2. WHERE the professional enters a session record THEN the system SHALL treat this content as professional-entered and SHALL NOT generate or auto-populate it with AI.
3. WHEN a professional saves a session record THEN the system SHALL persist it, associate it with that appointment, professional, and client, and add it to the client's medical history.
4. WHEN a professional edits a session record they previously entered THEN the system SHALL persist the update.
5. IF a required field of the session record is empty on save THEN the system SHALL prevent saving and indicate what is required.
6. WHERE a session record exists THEN the system SHALL restrict edit access to the professional who created it.

---

## Requirement 13: Persistent Client Medical History and Continuity of Care

**User Story:** As a professional, I want to view a client's medical history from prior sessions, so that I can provide continuity of care whether or not the client has seen me before.

#### Acceptance Criteria
1. WHEN an intake, patient summary, or session record is created THEN the system SHALL save it to the client's profile as part of their ongoing medical history.
2. WHEN a professional (nutritionist or fitness trainer) is booked for an appointment with a client THEN the system SHALL make the client's prior medical history visible to that professional for the appointment.
3. WHERE medical history is displayed THEN the system SHALL include prior intakes, prior AI-generated patient summaries, and prior professional-entered diagnoses/plans, regardless of which professional or professional type produced them.
4. WHEN a professional views medical history THEN the system SHALL present entries in a clear chronological order.
5. WHERE a user accesses medical history THEN the system SHALL restrict access to the client themselves and to professionals who have a booked appointment with that client, and SHALL NOT expose it to other users.
6. WHEN a client views their own profile THEN the system SHALL allow them to view their complete medical history.

---

## Requirement 14: AI Integration Reliability and Safety

**User Story:** As the platform operator, I want AI calls to be secure and resilient, so that the experience is reliable and credentials are protected.

#### Acceptance Criteria
1. WHERE the system calls the AI API (type classification, follow-up questions, matching, or patient summary) THEN the system SHALL keep API keys server-side and SHALL NOT expose them to the client.
2. WHEN an AI API call exceeds a configured timeout THEN the system SHALL abort the call and return a retryable error to the user.
3. WHEN the AI returns a response THEN the system SHALL validate its structure before using it and treat malformed output as a failure.
4. WHERE AI output is displayed to users THEN the system SHALL treat the AI response as untrusted content and avoid executing or blindly trusting embedded instructions.
5. WHERE client health data is sent to the AI API THEN the system SHALL send only the data needed for the task and SHALL handle it consistent with the client's medical history access restrictions.

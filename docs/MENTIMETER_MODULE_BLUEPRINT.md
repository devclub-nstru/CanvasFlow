# CanvasFlow Mentimeter Module: Architecture & Feature Blueprint

This document specifies the technical design, data models, real-time communication pipeline, and user experience requirements for implementing an interactive, live presentation tool (similar to Mentimeter) within CanvasFlow.

---

## 1. Feature Concept & Overview

The Mentimeter module enables creators to build interactive slide presentations with real-time audience participation:
1. **Presenter View (`/menti/[code]/present` or `/dashboard/presentations/[id]/present`)**: Full-screen slide projector view displaying live animated vote charts, word clouds, countdown timers, and quiz leaderboards as responses arrive.
2. **Audience Mobile View (`/menti/[code]` or `/join`)**: Instant join via a 6-digit room code or QR code (no registration required), synchronized to the presenter's active slide to vote or submit questions.
3. **Presentation Builder (`/dashboard/presentations/[id]/builder`)**: Slide deck creator where presenters add questions, customize options, configure timers, and organize slide decks.

---

## 2. Core Data Models (PostgreSQL / Drizzle Schema)

### 1. `presentationsTable`
- `id`: `uuid` (Primary Key)
- `title`: `varchar(150)`
- `slug`: `varchar(150)` (unique)
- `ownerId`: `text` (references `usersTable.id`)
- `joinCode`: `varchar(10)` (unique, e.g. "482910")
- `isLive`: `boolean` (default: `false`)
- `activeSlideId`: `uuid` (references `slidesTable.id`, nullable)
- `allowAnonymous`: `boolean` (default: `true`)
- `createdAt` / `updatedAt`: `timestamp`

### 2. `slidesTable`
- `id`: `uuid` (Primary Key)
- `presentationId`: `uuid` (references `presentationsTable.id` with cascade)
- `type`: `pgEnum` (`MULTIPLE_CHOICE`, `WORD_CLOUD`, `OPEN_ENDED`, `SCALES`, `QUIZ`, `LEADERBOARD`, `CONTENT`)
- `question`: `text`
- `description`: `text` (optional)
- `options`: `jsonb` (for choices, rating labels, correct answer keys)
- `settings`: `jsonb` (e.g. `timerSeconds`, `showCorrectAnswer`, `maxSubmissionsPerUser`, `multipleSelection`)
- `index`: `numeric(scale: 2)` (fractional ordering index)
- `createdAt` / `updatedAt`: `timestamp`

### 3. `presentationSessionsTable`
- `id`: `uuid` (Primary Key)
- `presentationId`: `uuid`
- `joinCode`: `varchar(10)`
- `status`: `enum` (`WAITING`, `ACTIVE`, `ENDED`)
- `startedAt` / `endedAt`: `timestamp`

### 4. `slideResponsesTable`
- `id`: `uuid` (Primary Key)
- `slideId`: `uuid` (references `slidesTable.id`)
- `sessionId`: `uuid`
- `participantId`: `varchar(64)` (fingerprint or anonymous session token)
- `participantName`: `varchar(100)` (for quiz / leaderboard)
- `value`: `jsonb` (selected choice ID, text word array, numeric scale ratings)
- `timeTakenMs`: `integer`
- `createdAt`: `timestamp`

---

## 3. Real-Time Communication Architecture

```
  ┌────────────────────────────────────────────────────────┐
  │                   Presenter Screen                     │
  │ (Subscribed to Slide Changes & Live Aggregated Votes)  │
  └───────────────────────────▲────────────────────────────┘
                              │ SSE / WebSocket / Redis PubSub
  ┌───────────────────────────┴────────────────────────────┐
  │                 CanvasFlow Backend                     │
  │  - Redis Channel: `menti:session:<sessionId>`          │
  │  - Action Handlers: NextSlide, SubmitVote, ResetVote   │
  └───────────────────────────▲────────────────────────────┘
                              │ HTTP POST (tRPC Mutation)
  ┌───────────────────────────┴────────────────────────────┐
  │                 Audience Mobile Clients                │
  │          (Votes on active slide via Join Code)         │
  └────────────────────────────────────────────────────────┘
```

1. **Presenter Controls**:
   - Next/Previous slide broadcasts `{ type: "SLIDE_CHANGED", slideId, slideIndex }`.
   - Lock/Unlock voting broadcasts `{ type: "VOTING_STATUS", isLocked: boolean }`.
2. **Audience Submission**:
   - Mobile client submits vote via tRPC `submitSlideResponse`.
   - Backend saves to Postgres and publishes `{ type: "NEW_VOTE", slideId, data }` to Redis Pub/Sub.
   - Presenter client receives delta and animates live charts (Recharts / Framer Motion).

---

## 4. Supported Slide & Interaction Types

1. **Multiple Choice Poll**:
   - Bar chart or donut chart with animated percentage growth.
   - Live voter count pill.
2. **Word Cloud**:
   - Dynamic clustering of audience word submissions, scaling font size with frequency.
3. **Open Ended & Q&A**:
   - Floating response cards with audience upvoting.
4. **Scales & Matrix**:
   - Spider / 1-to-5 slider score averages across dimensions.
5. **Interactive Quiz**:
   - Timed multiple choice with countdown sound/visuals, reveal correct answer step, and live leaderboard showing top scorers with avatar badges.

---

## 5. UI / UX Design Principles for Menti

- **Presenter UI**: Fullscreen dark or cream presentation mode with high-contrast typography (`.cf-display`), minimal non-intrusive floating control bar at bottom (`Previous`, `Next`, `Full Screen`, `QR Code Modal`, `Responses Count`).
- **Audience Mobile UI**: Ultra-clean mobile-first layout with instant feedback animations when a button is pressed, disabled state while waiting for the presenter to change slides, and a cheerful "Answer Submitted!" checkmark screen.

# Backend Modules README

This directory documents the modular architecture used by the backend of PRE PAL.

## Overview

The backend is organized into reusable feature modules that separate major business areas such as:
- Study room / project collaboration
- Quiz workflows
- Mock interviews
- PYQ management and processing

While the legacy chat/project routes remain available for backward compatibility, the current architecture includes dedicated modules for newer features.

## Current Modules

### 1. Study Room / Project Module
Location:
- `backend/routes/project.routes.js`
- `backend/controllers/project.controller.js`
- `backend/models/project.model.js`
- `backend/routes/studyroom.routes.js`
- `backend/controllers/studyroom.controller.js`

Responsibilities:
- Create, join, and manage rooms
- Public/private access control
- Room ownership and participant moderation
- Shared file operations
- Real-time collaboration

### 2. Quiz Module
Location:
- `backend/modules/quiz/`

Responsibilities:
- Quiz creation and result tracking
- Learning and assessment flows
- Module-level route/controller separation

### 3. Interview Module
Location:
- `backend/modules/interview/`

Responsibilities:
- Mock interview sessions
- Question generation
- Feedback collection and evaluation
- Session tracking and result retrieval

### 4. PYQ Module
Location:
- `backend/modules/pyq/`

Responsibilities:
- Previous-year question import and management
- Subject-based organization
- Prediction and duplicate checks
- Sample paper support
- Academic document processing flows

## Shared Backend Services

The application relies on central shared components:
- `auth.middleware.js` for protected route access
- `ai.services.js` for AI-powered logic
- `hume.services.js` for voice-related AI features
- `moderation.service.js` for inappropriate-content checks
- `project.services.js` and related service layers for room/project logic
- Mongoose models for persistence and data organization

## Route Registration

The main backend app registers routes in `backend/app.js`:
- `/auth` for authentication
- `/users` for user endpoints
- `/project` for legacy project/chat flows
- `/studyroom` for study room routes
- `/quiz` for quiz endpoints
- `/api/interview` for interview routes
- `/pyq` and `/api/pyq` for PYQ APIs

## Module Design Principles

The module system is designed to:
- keep feature logic separated by domain
- support easier scaling and maintenance
- preserve backward compatibility with older routes
- simplify new feature integration

## Backward Compatibility

Legacy routes remain available so older frontend code and older workflows continue to function while newer modules are being used.

## Adding a New Module

A typical module layout looks like:

```text
backend/modules/<module-name>/
├── controllers/
├── models/
├── routes/
└── services/
```

Recommended flow:
1. Create the module folder
2. Add route definitions
3. Add controller logic
4. Add model and service files if needed
5. Register the module in `backend/app.js`
6. Protect routes with auth middleware when needed

## Notes

This repository has evolved from a simpler collaboration app into a broader learning ecosystem. The modular backend architecture reflects that evolution and separates the platform into reusable feature domains.

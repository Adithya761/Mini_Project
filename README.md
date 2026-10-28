# VOID PREP - AI-Powered Collaborative Learning Platform

A modern learning and collaboration ecosystem built for students and teams to study together, generate practice materials, conduct mock interviews, and collaborate in real time.

This version of the project includes:
- Real-time collaborative study rooms
- Public/private project rooms with access codes
- AI chat and moderation
- Whiteboard collaboration
- Quiz generation and evaluation
- Mock interview module
- PYQ and document-based learning workflows
- React + Express + MongoDB architecture

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-19.1.0-blue.svg)

## Overview

VOID PREP is designed to make learning collaborative and intelligent. Users can create or join study spaces, share files, chat live, draw together, generate quizzes, and practice interview questions.

The platform is structured as a modular ecosystem with a backend API, a frontend application, and supporting AI/document-processing components.

## Key Features

### Collaboration
- Create and join public or private study rooms
- Join by room code for private access
- Real-time chat and messaging
- User ownership and moderation controls
- Remove participants from a room when needed
- Shared file uploads and downloads

### AI & Learning
- AI-powered assistant for questions and guidance
- Quiz generation and assessment workflows
- Mock interview support for skill practice
- PYQ / previous-year-question workflows
- Document-based learning and RAG-style support

### Workspace Experience
- Interactive whiteboard for shared brainstorming
- Project discovery and public room listing
- Multi-user collaboration in one environment
- Responsive frontend built with React and Vite

## Tech Stack

### Frontend
- React 19
- Vite
- React Router
- Socket.IO Client
- Tailwind CSS
- Framer Motion
- Axios

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.IO
- JWT Authentication
- Redis support
- Groq and Hume AI integrations

### Additional Components
- Python-based local RAG workflow support
- Document parsing for PDFs and docs
- AI-driven evaluation and study assistance

## Project Structure

```text
Mini_Project/
├── backend/                  # Express API server
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── modules/
│   │   ├── quiz/
│   │   ├── interview/
│   │   └── pyq/
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env.example (if present)
├── frontend/                 # React app
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.*
├── local_rag_python/         # Python-based RAG/local AI helpers
├── README.md
├── package.json
├── run.bat
├── run.ps1
├── stop.bat
├── API_DOCUMENTATION.md
├── QUICK_START_GUIDE.md
├── DEPLOYMENT.md
├── CONTRIBUTING.md
├── LICENSE
└── PROJECT_COMPLETE_SUMMARY.md
```

## Prerequisites

Before running the project, make sure you have:
- Node.js 18+
- npm
- MongoDB running locally or through MongoDB Atlas
- Redis (optional, for caching and session-related features)
- Git

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Adithya761/Mini_Project.git
cd Mini_Project
```

### 2. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Configure environment variables

Create a `.env` file in the `backend` directory with values similar to:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/mini_project
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=your_groq_key
HUME_API_KEY=your_hume_key
HUME_SECRET_KEY=your_hume_secret
HUME_CONFIG_ID=your_hume_config_id
REDIS_HOST=localhost
REDIS_PORT=6379
```

Frontend environment variables can be set in `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

## Running the Application

### Quick start

From the project root:

```bash
npm start
```

This repository also includes Windows helper scripts:

```powershell
./run.bat
./run.ps1
```

### Manual run

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Then open:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Main Modules

### Study Rooms / Projects
- Create public or private rooms
- Room codes for private access
- Live chat, discussions, and collaboration
- Owner controls and role management
- File sharing and downloads

### Quiz Module
- Topic-based learning and quiz generation
- LMS-style practice flow
- Evaluation and result tracking

### Interview Module
- AI-assisted mock interview setup
- Practice question flow
- Feedback-oriented interview experience

### PYQ Module
- Previous-year question support
- Learning and document-based retrieval workflows
- Study resource integration

### AI Assistant
- Context-aware help in chat
- Moderation for inappropriate content
- Study support and guidance

## API & Docs

This repository includes detailed documentation for many parts of the system:
- `API_DOCUMENTATION.md`
- `QUICK_START_GUIDE.md`
- `DEPLOYMENT.md`
- `STUDY_ROOMS_GUIDE.md`
- `PROJECT_COMPLETE_SUMMARY.md`
- `FEATURE_IMPLEMENTATION_COMPLETE.md`

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push the branch
5. Open a pull request

See `CONTRIBUTING.md` for full project contribution guidelines.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Support

For questions, setup help, or deployment issues, refer to the docs in this repository or open an issue in the GitHub project.

## Acknowledgements

- Socket.IO for real-time collaboration
- MongoDB for data persistence
- Groq AI and Hume AI for intelligent features
- The open-source community

---

Built for collaborative learning, practice, and AI-powered academic support.

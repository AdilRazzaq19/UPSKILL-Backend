# UPSKILL-Backend

Backend services for the UPSKILL platform, providing APIs for user authentication, course management, progress tracking, and more.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Documentation](#api-documentation)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- User authentication and authorization (JWT)
- CRUD operations for Themes, Sections, Modules, Videos, Skills, Badges, etc.
- Progress tracking and badge awarding
- Onboarding session management
- Admin console integration

## Prerequisites

- Node.js (v14+)
- npm or yarn
- MongoDB

## Installation

1. Clone the repo
   ```bash
   git clone https://github.com/AdilRazzaq19/UPSKILL-Backend.git
   cd UPSKILL-Backend
   ```
2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

## Configuration

Create a `.env` file in the root directory and set the following variables:

```
PORT=5000
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
YOUTUBE_API_KEY=<your-youtube-api-key>
```

## Running the Server

- Development mode (with nodemon):
  ```bash
  npm run dev
  ```
- Production mode:
  ```bash
  npm start
  ```

The server will start on `http://localhost:<PORT>`.

## API Documentation

Access the live API documentation hosted on Postman:

[![Postman](https://img.shields.io/badge/Postman-API-blue)](https://documenter.getpostman.com/view/42387212/2sB2j1hsVH)

Or visit: [View Hosted API Documentation](https://documenter.getpostman.com/view/42387212/2sB2j1hsVH)

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and receive JWT token

### Users

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user (admin)
- `DELETE /api/users/:id` - Delete user (admin)

### Themes

- `GET /api/themes` - List all themes
- `POST /api/themes` - Create a new theme
- `GET /api/themes/:id` - Get theme by ID
- `PUT /api/themes/:id` - Update theme
- `DELETE /api/themes/:id` - Delete theme

### Sections

- `GET /api/sections` - List all sections
- `POST /api/sections` - Create a new section
- `GET /api/sections/:id` - Get section by ID
- `PUT /api/sections/:id` - Update section
- `DELETE /api/sections/:id` - Delete section

### Modules

- `GET /api/modules` - List all modules
- `POST /api/modules` - Create a new module
- `GET /api/modules/:id` - Get module by ID
- `PUT /api/modules/:id` - Update module
- `DELETE /api/modules/:id` - Delete module

### Videos

- `GET /api/videos` - List all videos
- `POST /api/videos` - Create a new video
- `GET /api/videos/:id` - Get video by ID
- `PUT /api/videos/:id` - Update video
- `DELETE /api/videos/:id` - Delete video

### Badges

- `GET /api/badges` - List all badges
- `POST /api/badges` - Create a new badge
- `GET /api/badges/:id` - Get badge by ID
- `PUT /api/badges/:id` - Update badge
- `DELETE /api/badges/:id` - Delete badge

### Progress

- `GET /api/progress/:userId` - Get user progress
- `PUT /api/progress/:userId` - Update user progress
- `POST /api/progress/:userId/badges` - Award badge to user

### Onboarding

- `GET /api/onboarding/:userId` - Get onboarding session
- `POST /api/onboarding` - Create or update onboarding session

### Skills

- `GET /api/skills` - List all skills
- `POST /api/skills` - Create a new skill
- `GET /api/skills/:id` - Get skill by ID
- `PUT /api/skills/:id` - Update skill
- `DELETE /api/skills/:id` - Delete skill

## Project Structure

```
.
├── controllers
├── models
├── routes
├── middleware
├── utils
├── config
└── server.js
```

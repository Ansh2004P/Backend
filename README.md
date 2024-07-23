# YouTube-like Application Backend

## Overview

This project is the backend for a YouTube-like application that includes all core features of YouTube and additional functionalities like Twitter-style tweets. The backend is built with Node.js, Express, and MongoDB, utilizing Mongoose for schema management.

## Features

- **Video Management:**
  - Upload, retrieve, update, and delete videos.
  - Manage video metadata and privacy settings.

- **Playlist Management:**
  - Create, update, and delete playlists.
  - Add or remove multiple videos to/from playlists.

- **User Management:**
  - User registration and authentication.
  - Profile management and user roles.
  - Subscription management: Users can subscribe to and unsubscribe from other users' channels.

- **Tweet Management:**
  - Upload and manage tweets (text and media).

## Getting Started

### Prerequisites

- Node.js (>= 14.x)
- MongoDB (>= 4.4)
- A modern web browser

### Installation

1. **Clone the Repository:**

   ```bash
   https://github.com/Ansh2004P/Backend.git
   cd Backend

2. **Install Dependencies:**
     ```bash
     npm install

3. **Set up environment variables:**

     ```bash
     MONGODB_URI=your_mongo_URI
     PORT=8000
     JWT_SECRET=your_jwt_secret_key

4. **Run the Application:**

     ```bash
     npm run dev

5.  **Error Handling**

    The API uses HTTP status codes and custom error messages to indicate issues. Common error responses include:

   - **300 Unauthorized:** Authentication issues.
   - **400 User Error:** data parsing error.
   - **404 Not Found:** Resource not found.
   - **500 Internal Server Error:** Server-side errors.

6. **Contact**

    For any questions or inquiries, please reach out to:

   - **Email:** anshkpatel15@gmail.com
   - **GitHub:** [Ansh2004P](https://github.com/Ansh2004P/)
 

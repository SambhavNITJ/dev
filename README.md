# Collaborative Document Editor

A real-time collaborative document editing and chat application built with Socket.IO and Express.js. Users can create rooms, share documents, and chat in real-time.

## Features

- Create or join rooms using unique room codes
- Real-time document creation and editing
- Live chat functionality
- No database required - uses in-memory storage
- Clean and intuitive user interface

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Creating a Room**
   - Click "Create New Room"
   - Share the generated room code with others

2. **Joining a Room**
   - Enter the room code
   - Click "Join Room"

3. **Working with Documents**
   - Create new documents using the "New Document" button
   - Click on any document to edit it
   - All changes are synchronized in real-time

4. **Chat Feature**
   - Use the chat panel on the right to communicate with other users in the room

## Note

All data is stored in memory and will be cleared when the server restarts or when users disconnect.

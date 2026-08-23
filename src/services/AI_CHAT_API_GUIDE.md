# AI Chat Database Integration Guide

This document describes the backend API endpoints needed for AI chat persistence.

## Overview

The AI Agent Modal now saves all chat conversations to the database and retrieves them when the modal opens. This provides a continuous chat experience across sessions.

## API Endpoints Required

### 1. Save AI Chat
**POST** `/api/ai-chat/save`

Save chat messages to the database.

**Request Body:**
```json
{
  "messages": [
    {
      "id": "unique-message-id",
      "type": "user|agent|friend-picker|video-results|actions",
      "content": "message text",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "// ... other message properties"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "chatId": "chat-session-id",
  "savedAt": "2024-01-01T12:00:00.000Z"
}
```

### 2. Fetch Latest AI Chat
**GET** `/api/ai-chat/latest`

Fetch the most recent chat session for the current user.

**Response:**
```json
{
  "chatId": "chat-session-id",
  "messages": [
    {
      "id": "unique-message-id",
      "type": "user|agent|friend-picker|video-results|actions",
      "content": "message text",
      "timestamp": "2024-01-01T12:00:00.000Z"
      "// ... other message properties"
    }
  ],
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

### 3. Fetch All AI Chat History (Optional)
**GET** `/api/ai-chat/history`

Fetch all chat sessions for the current user (paginated recommended).

**Query Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional): Number of results per page (default: 20)

**Response:**
```json
{
  "chats": [
    {
      "chatId": "chat-session-id",
      "messages": [
        {
          "id": "unique-message-id",
          "type": "user|agent|...",
          "content": "message text",
          "timestamp": "2024-01-01T12:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### 4. Delete AI Chat (Optional)
**DELETE** `/api/ai-chat/delete`

Delete a specific chat session or all chat history.

**Query Parameters:**
- `chatId` (optional): Specific chat to delete. If omitted, deletes all chats.

**Response:**
```json
{
  "success": true,
  "message": "Chat(s) deleted successfully",
  "deletedCount": 1
}
```

## Database Schema (Suggested)

### AIChat Collection/Table
```javascript
{
  _id: ObjectId,
  userId: ObjectId,  // Reference to User
  messages: [
    {
      id: String,
      type: String,
      content: String,
      timestamp: Date,
      // ... other message properties
    }
  ],
  createdAt: Date,
  updatedAt: Date,
  expiresAt: Date  // Optional: Auto-delete old chats after X days
}
```

## Client-Side Implementation

### Service Functions

**`saveAIChat(messages)`** - Saves messages to database
- Called automatically on modal close
- Debounced (saves after 1.5 seconds of no changes)

**`fetchLatestAIChat()`** - Fetches most recent chat session
- Called when modal opens
- Falls back to initial message if no previous chat exists

**`fetchAIChatHistory()`** - Fetches all chat sessions
- Optional for future chat history sidebar
- Paginated support recommended

**`deleteAIChat(chatId)`** - Deletes a specific chat or all chats
- Optional for user chat management

## Backend Implementation Notes

### Authentication
- All endpoints require user authentication via token in `Authorization` header
- Only allow users to access their own chat history

### Message Serialization
- Some message properties (e.g., `onAction`, `onPlay` callbacks) are functions and cannot be serialized
- Consider filtering out non-serializable properties before saving
- Reconstruction of these callbacks happens client-side after retrieval

### Storage Optimization
- Consider implementing data compression for long chat histories
- Implement auto-deletion policy for old chats (e.g., delete after 90 days)
- Use pagination for chat history endpoint

### Example Node.js/Express Implementation

```javascript
// POST /api/ai-chat/save
app.post('/api/ai-chat/save', requireAuth, async (req, res) => {
  try {
    const { messages } = req.body;
    const userId = req.user.id;
    
    // Find latest chat or create new one
    let chat = await AIChat.findOne({ userId }).sort({ createdAt: -1 });
    
    if (!chat) {
      chat = new AIChat({ userId, messages: [] });
    }
    
    // Update messages
    chat.messages = messages;
    chat.updatedAt = new Date();
    
    await chat.save();
    
    res.json({
      success: true,
      chatId: chat._id,
      savedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai-chat/latest
app.get('/api/ai-chat/latest', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const chat = await AIChat.findOne({ userId }).sort({ createdAt: -1 });
    
    if (!chat) {
      return res.json({ messages: [] });
    }
    
    res.json({
      chatId: chat._id,
      messages: chat.messages,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Frontend Error Handling

- If chat save fails, the UI continues normally (graceful degradation)
- If chat fetch fails on modal open, shows initial message
- All errors are logged to console for debugging
- Network errors are caught and handled silently

## Notes

- Messages are automatically saved with 1.5-second debounce to avoid excessive API calls
- Chat is saved on component unmount as backup
- Non-serializable function properties are excluded from database storage
- Client reconstructs UI-specific callbacks after retrieval

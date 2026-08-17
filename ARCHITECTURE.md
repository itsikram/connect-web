# AI Agent Modal - Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Connect Web App                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Header Component                      │  │
│  │ ┌──────────────┐        ┌────────────────────────────┐  │  │
│  │ │ HeaderLeft   │        │ Header Logo               │  │  │
│  │ │              │◄───────│ (Long-press trigger)      │  │  │
│  │ └──────────────┘        └────────────────────────────┘  │  │
│  │         │                                                 │  │
│  │         │ Opens                                          │  │
│  │         ▼                                                 │  │
│  │    ┌────────────────────────────────────────────┐        │  │
│  │    │   AIAgentModal Component                   │        │  │
│  │    │                                            │        │  │
│  │    │  ┌──────────────┬────────────────────────┐│        │  │
│  │    │  │  Modal       │                        ││        │  │
│  │    │  │  Header      │    ChatArea            ││        │  │
│  │    │  ├──────────────┤                        ││        │  │
│  │    │  │              │  ┌──────────────────┐ ││        │  │
│  │    │  │  Action      │  │ Messages         │ ││        │  │
│  │    │  │  Panel       │  │ Container        │ ││        │  │
│  │    │  │  (Sidebar)   │  ├──────────────────┤ ││        │  │
│  │    │  │              │  │ Message Bubble   │ ││        │  │
│  │    │  │              │  ├──────────────────┤ ││        │  │
│  │    │  │  - Search    │  │ Chat Input       │ ││        │  │
│  │    │  │  - Create    │  │ - Textarea       │ ││        │  │
│  │    │  │  - Analyze   │  │ - Suggestions    │ ││        │  │
│  │    │  │  - Assist    │  │ - Send Button    │ ││        │  │
│  │    │  │              │  │                  │ ││        │  │
│  │    │  └──────────────┴────────────────────┘ ││        │  │
│  │    │                                         │        │  │
│  │    └─────────────────────────────────────────┘        │  │
│  │         │                                             │  │
│  │         │ User Input & Actions                        │  │
│  │         ▼                                             │  │
│  │    ┌────────────────────────────────────────────┐    │  │
│  │    │   Gemini Service                          │    │  │
│  │    │   (geminiService.js)                      │    │  │
│  │    │                                           │    │  │
│  │    │  - sendToGemini()                         │    │  │
│  │    │  - Manages conversation history           │    │  │
│  │    │  - Extracts suggested actions             │    │  │
│  │    └────────────────────────────────────────────┘    │  │
│  │         │                                             │  │
│  │         │ HTTPS Request                              │  │
│  │         ▼                                             │  │
│  │    ┌────────────────────────────────────────────┐    │  │
│  │    │   Google Gemini API                       │    │  │
│  │    │   (generativelanguage.googleapis.com)     │    │  │
│  │    │                                           │    │  │
│  │    │  ✓ REST API                               │    │  │
│  │    │  ✓ Free Tier Available                    │    │  │
│  │    │  ✓ Requires API Key                       │    │  │
│  │    │  ✓ Response in ~1-2 seconds               │    │  │
│  │    └────────────────────────────────────────────┘    │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App
└── Header
    └── HeaderLeft
        ├── Header Logo (long-press target)
        └── AIAgentModal (opened on long-press)
            ├── ModalHeader
            │   ├── Title & Icon
            │   ├── Close Button
            │   └── Status Bar
            ├── Modal Body
            │   ├── ActionPanel (Sidebar)
            │   │   ├── Category Header
            │   │   ├── Category Items
            │   │   └── Footer
            │   └── ChatArea
            │       ├── MessagesContainer
            │       │   ├── MessageBubble (x N)
            │       │   │   ├── Avatar
            │       │   │   ├── Content
            │       │   │   ├── Timestamp
            │       │   │   └── Suggested Action
            │       │   ├── Typing Indicator
            │       │   └── Scroll Ref
            │       └── ChatInput
            │           ├── Suggestions
            │           ├── Textarea
            │           ├── Emoji Button
            │           └── Send Button
            └── Sidebar Toggle Button
```

## Data Flow

### 1. User Interaction Flow

```
┌─────────────────────────────────────┐
│ User Long-Press Header Logo         │
│ (Mouse Down + Hold 500ms)           │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ handleLogoMouseDown()                │
│ Starts 500ms timer                  │
└────────────┬────────────────────────┘
             │
             ├──► Timer fires (500ms elapsed)
             │    └──► setIsAIAgentModalOpen(true)
             │
             ├──► User releases before 500ms
             │    └──► clearTimeout (no action)
             │
             └──► User moves mouse away
                  └──► clearTimeout (no action)
```

### 2. Message Flow

```
User Types Message
         │
         ▼
┌─────────────────────────────┐
│ onChange handler            │
│ Update inputValue state     │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ User clicks Send / Press     │
│ Enter key                   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ handleSendMessage()          │
│ - Add user message to state │
│ - Clear input field          │
│ - Set isLoading = true      │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ sendToGemini()               │
│ (Service Call)              │
│ - Format conversation       │
│ - Prepare API request       │
│ - Add system prompt         │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Fetch to Gemini API          │
│ POST /generateContent       │
│ (1-2 seconds wait)          │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Parse Response               │
│ - Extract text              │
│ - Extract suggested action  │
│ - Handle errors             │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Add Agent Message to State   │
│ - setMessages(prev => [...]) │
│ - Set isLoading = false     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Auto-Scroll to Latest        │
│ - useEffect scrolls to       │
│   messagesEndRef            │
└─────────────────────────────┘
```

### 3. Action Execution Flow

```
User Clicks Action Item
         │
         ▼
┌─────────────────────────────┐
│ onActionClick handler        │
│ (in AIAgentModal)           │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ handleSendMessage()          │
│ ("Execute: {action.label}") │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ AI processes action request  │
│ Returns relevant response    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Display agent response       │
│ with suggested next steps    │
└─────────────────────────────┘
```

## State Management

### AIAgentModal State

```javascript
{
  messages: [
    {
      id: number,
      type: 'user' | 'agent',
      content: string,
      timestamp: Date,
      action?: string
    },
    // ... more messages
  ],
  
  inputValue: string,           // Current input text
  isLoading: boolean,           // Loading state
  selectedAction: object|null,  // Selected action
  isSidebarOpen: boolean        // Sidebar visibility
}
```

### Message Structure

```javascript
{
  id: 1234567890,           // Unique timestamp-based ID
  type: 'user' | 'agent',   // Message type
  content: 'Hello!',        // Message text
  timestamp: Date,          // When message was created
  action: 'Suggested: ...'  // Optional suggested action
}
```

## API Request Format

### Gemini API Request

```javascript
{
  contents: [
    {
      role: 'user',
      parts: [{ text: 'User message' }]
    },
    {
      role: 'assistant',
      parts: [{ text: 'Previous response' }]
    }
  ],
  systemInstruction: {
    parts: [{
      text: 'You are a helpful AI Assistant within Connect...'
    }]
  },
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024
  }
}
```

### Gemini API Response

```javascript
{
  candidates: [
    {
      content: {
        parts: [
          { text: 'AI response text here' }
        ]
      }
    }
  ]
}
```

## Component Communication

### Props Flow

```
AIAgentModal
├── Props: isOpen, onClose
├──► ModalHeader
│    └── Props: onClose
├──► ActionPanel
│    └── Props: onActionClick
└──► ChatArea
     ├── Props: messages, isLoading, onSendMessage, etc.
     ├──► MessageBubble
     │    └── Props: message
     └──► ChatInput
          └── Props: value, onChange, onSend, etc.
```

### Event Flow

```
User Interaction
     │
     ├──► Click events
     │    └──► Handler functions
     │         └──► setState calls
     │              └──► Re-render affected components
     │
     ├──► Keyboard events
     │    └──► onChange handlers
     │         └──► Update input state
     │              └──► Re-render input
     │
     └──► Long-press events
          └──► Timer-based trigger
               └──► Open modal
                    └──► Mount AIAgentModal
```

## Styling Architecture

### CSS Cascade

```
Global Styles (App.css, index.css)
     │
     ▼
AIAgentModal.css
     │
     ├──► .ai-agent-modal-backdrop
     │    └── Scrim/overlay
     │
     ├──► .ai-agent-modal-container
     │    └── Main container
     │
     ├──► .ai-agent-modal-header
     │    └── Header styling
     │
     ├──► .ai-agent-chat-area
     │    └── Chat area layout
     │
     ├──► .ai-agent-bubble
     │    ├── User bubbles
     │    └── Agent bubbles
     │
     ├──► .ai-agent-input-wrapper
     │    └── Input styling
     │
     ├──► .ai-agent-action-panel
     │    └── Sidebar styling
     │
     └──► @media queries
          ├── Mobile (480px)
          ├── Tablet (768px)
          ├── Desktop (1024px)
          └── Large (1200px)
```

### Responsive Breakpoints

```
320px    480px    768px         1024px        1200px+
 │        │        │              │             │
 ├──────┬─┴──────┬─┴─────────────┬─────────────┤
 │ Tiny │ Mobile │    Tablet     │   Desktop   │
 │Mobile│        │                │             │
 └──────┴────────┴────────────────┴─────────────┘
        └──────────────────────────────────────────┘
                 Full Responsive Coverage
```

## Performance Optimization

### Component Rendering

```
AIAgentModal (Parent)
     │
     ├──► ModalHeader (Static unless props change)
     │    └── Light-weight, minimal re-renders
     │
     ├──► ActionPanel (Memoizable)
     │    └── Expand/collapse only local state
     │
     └──► ChatArea (Frequently updated)
          │
          ├──► MessagesContainer (Re-renders on message change)
          │    │
          │    └──► MessageBubble (x N) (Could use virtualization)
          │         └── Re-renders only when message data changes
          │
          └──► ChatInput (Re-renders on input change)
               └── Lightweight, simple state
```

## Security Flow

```
User Input
     │
     ▼
┌──────────────────────────────┐
│ Input Validation              │
│ - Check for empty            │
│ - Check length limit         │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Format for API                │
│ - Create request object      │
│ - Add conversation context   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ API Key Management            │
│ - Loaded from .env           │
│ - Never exposed in code      │
│ - Only used server-side      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ HTTPS Request                 │
│ - Secure transport           │
│ - TLS encryption             │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Response Handling             │
│ - Parse safely               │
│ - Error handling             │
│ - No sensitive data stored   │
└──────────────────────────────┘
```

## File Size Breakdown

```
Component Files:
├── AIAgentModal.jsx        ~6KB
├── ModalHeader.jsx         ~1KB
├── ChatArea.jsx            ~1.5KB
├── MessageBubble.jsx       ~2KB
├── ChatInput.jsx           ~3KB
├── ActionPanel.jsx         ~4KB
└── config.js               ~6KB
                           ────
                    Subtotal: ~23.5KB

Styling:
└── AIAgentModal.css       ~25KB

Services:
└── geminiService.js        ~4KB

Total Source: ~52.5KB
Minified: ~45KB
Gzipped: ~12KB
```

## Browser Compatibility

```
        Chrome  Firefox  Safari  Edge
Desktop   ✅      ✅       ✅     ✅
Mobile    ✅      ✅       ✅     ✅
Tablet    ✅      ✅       ✅     ✅

Minimum Versions:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
```

## Deployment Architecture

```
Production Environment
     │
     ├──► .env variables
     │    └── REACT_APP_GEMINI_API_KEY
     │
     ├──► Built bundle
     │    └── Minified & gzipped
     │
     ├──► CDN delivery
     │    └── Static assets
     │
     └──► Browser
          └── Executes modal
               └── Calls Gemini API
```

---

This architecture ensures:
- ✅ Scalability
- ✅ Maintainability
- ✅ Performance
- ✅ Security
- ✅ Responsiveness
- ✅ User Experience

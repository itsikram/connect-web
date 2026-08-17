# AI Agent Modal - Complete Documentation

## Overview

The AI Agent Modal is a fully responsive, modern chat interface integrated into the Connect web app. It provides users with an intelligent assistant powered by Google Gemini AI, enabling them to perform various actions within the app through natural conversation.

## Features

### Core Features
- 🤖 **AI-Powered Chat**: Powered by Google Gemini Free API
- 💬 **Conversational Interface**: Natural language interactions
- 📱 **Fully Responsive**: Works seamlessly on desktop, tablet, and mobile
- 🎨 **Modern UI/UX**: Beautiful gradient design with smooth animations
- ⚡ **Real-time Responses**: Instant AI feedback
- 🔐 **Secure**: No sensitive data stored locally

### User Actions
The AI Agent can help with:
- **Search & Discover**: Find users, posts, videos, trending content
- **Create & Share**: Create posts, upload videos, start live streams, create stories
- **Analytics & Insights**: Summarize content, get recommendations, analyze sentiment, view statistics
- **Assistance**: Write captions, translate text, get help, report issues

## How to Use

### For Users
1. **Long-press the header logo** (500ms press) to open the AI Agent Modal
2. Type your query or request in the chat input
3. AI Agent responds with helpful information or actions
4. Click action items from the sidebar to trigger specific tasks
5. Use the sidebar toggle button to hide/show quick actions

### For Developers

#### Setup

1. **Get Gemini API Key**
   ```bash
   # Visit: https://makersuite.google.com/app/apikey
   # Create a new API key (free tier available)
   ```

2. **Configure Environment Variables**
   ```bash
   # Create .env file in /web directory
   REACT_APP_GEMINI_API_KEY=your_api_key_here
   ```

3. **Install Dependencies**
   ```bash
   npm install framer-motion  # Already included in package.json
   ```

#### Component Structure

```
AIAgentModal/
├── AIAgentModal.jsx          # Main container & state management
├── ModalHeader.jsx           # Header with close button
├── ChatArea.jsx              # Messages display area
├── MessageBubble.jsx         # Individual message component
├── ChatInput.jsx             # Input field with suggestions
├── ActionPanel.jsx           # Sidebar with quick actions
├── AIAgentModal.css          # All styling (responsive)
└── README.md                 # This file
```

#### Integration with Header

The modal is integrated into `HeaderLeft.js`:

```javascript
import AIAgentModal from "../../components/modal/AIAgentModal/AIAgentModal";

// Add state
const [isAIAgentModalOpen, setIsAIAgentModalOpen] = useState(false);

// Add long-press handlers
const handleLogoMouseDown = () => {
  longPressTimer = setTimeout(() => {
    setIsAIAgentModalOpen(true);
  }, 500);
};

// Render modal
<AIAgentModal isOpen={isAIAgentModalOpen} onClose={() => setIsAIAgentModalOpen(false)} />
```

## Component Details

### AIAgentModal.jsx
**Responsibilities:**
- Main container component
- State management for messages, input, loading states
- Integration with Gemini API service
- Sidebar toggle functionality
- Modal open/close logic

**Props:**
- `isOpen: boolean` - Modal visibility state
- `onClose: function` - Callback to close modal

**State:**
- `messages: array` - Chat history
- `inputValue: string` - Current input text
- `isLoading: boolean` - API loading state
- `isSidebarOpen: boolean` - Sidebar visibility
- `selectedAction: object` - Currently selected action

### ModalHeader.jsx
**Responsibilities:**
- Display header with title and icon
- Close button
- Status indicator showing AI readiness
- Gradient background animation

**Features:**
- Animated icon with floating effect
- Status pulse indicator
- Smooth close button rotation on hover

### ChatArea.jsx
**Responsibilities:**
- Display all messages
- Loading indicator with typing animation
- Smooth auto-scroll to latest message
- Composition of MessageBubble and ChatInput

### MessageBubble.jsx
**Responsibilities:**
- Render individual messages
- Different styling for user vs agent messages
- Display timestamp and suggested actions
- Avatar icons with gradients

**Features:**
- Animated entrance
- Scale animation on appearance
- Different bubble colors and positions
- Time formatting

### ChatInput.jsx
**Responsibilities:**
- Text input with auto-resize
- Quick suggestion chips
- Send button with loading state
- Emoji button placeholder

**Features:**
- Auto-expanding textarea
- Smart suggestions
- Keyboard shortcuts (Enter to send)
- Loading spinner in send button

### ActionPanel.jsx
**Responsibilities:**
- Display quick action categories
- Expandable/collapsible categories
- Action items with icons
- Category header with chevron animation

**Features:**
- Smooth expand/collapse animations
- Icon-based actions
- Hover effects
- Staggered item animations

## Styling & Responsiveness

### Breakpoints
- **Desktop**: Full width layout with sidebar
- **Tablet** (max-width: 1024px): Sidebar width reduced
- **Mobile** (max-width: 768px): Sidebar becomes overlay
- **Small Mobile** (max-width: 480px): Optimized spacing and sizes

### Color Scheme
- **Primary Gradient**: #6366f1 to #8b5cf6 (Indigo to Purple)
- **Secondary**: #0ea5e9 (Cyan for user messages)
- **Text**: #1f2937 (Dark Gray)
- **Borders**: #e5e7eb (Light Gray)

### Dark Mode
Full support for `prefers-color-scheme: dark`

## API Integration

### Gemini Service (`geminiService.js`)

**Main Function: `sendToGemini(message, conversationHistory)`**

```javascript
import { sendToGemini } from '../../../services/geminiService';

const result = await sendToGemini(message, conversationHistory);
// Returns: { response, suggestedAction, success }
```

**Parameters:**
- `message: string` - User's message
- `conversationHistory: array` - Previous messages for context

**Response:**
```javascript
{
  response: "AI's response text",
  suggestedAction: "Suggested next action or null",
  success: true
}
```

**System Prompt:**
The AI is configured to:
- Help with Connect app features
- Be conversational and concise
- Suggest relevant next actions
- Provide practical assistance

## Customization

### Change AI Capabilities
Edit `ActionPanel.jsx` - Modify the `actions` array:

```javascript
const actions = [
  {
    category: 'custom',
    icon: 'fa-icon-name',
    label: 'Category Label',
    items: [
      { id: 1, label: 'Action', icon: 'fa-icon' },
    ],
  },
];
```

### Change Color Scheme
Edit `AIAgentModal.css` - Update gradient colors:

```css
.ai-agent-modal-header {
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

### Change Long-Press Duration
Edit `HeaderLeft.js` - Modify timeout value:

```javascript
setTimeout(() => {
  setIsAIAgentModalOpen(true);
}, 1000); // Change from 500ms to your desired value
```

### Disable Sidebar
Remove the sidebar toggle and always show sidebar:

```javascript
// In AIAgentModal.jsx
const [isSidebarOpen] = useState(true); // Remove state update
```

## Troubleshooting

### Modal Not Opening
- Check console for errors
- Verify long-press duration (try holding 1+ second)
- Ensure `AIAgentModal` is imported in `HeaderLeft.js`

### AI Not Responding
- Check Gemini API key in `.env`
- Verify API key has quota remaining
- Check browser console for network errors
- Ensure internet connection is active

### Styling Issues
- Clear browser cache (Ctrl+Shift+Delete)
- Rebuild project (npm start)
- Check if CSS file is properly imported

### Responsive Issues
- Test in browser dev tools device emulation
- Check media query breakpoints in CSS
- Verify viewport meta tag in HTML

## Performance Tips

1. **Message Virtualization** (for 100+ messages):
   - Implement `react-window` for large message lists
   - Only render visible messages

2. **Lazy Load Sidebar**:
   - Load ActionPanel only when modal opens
   - Use React.memo to prevent unnecessary re-renders

3. **Debounce Input**:
   - Current implementation is optimal for most use cases
   - Use `lodash.debounce` if needed for rate limiting

## Security Considerations

1. **API Key Security**:
   - Never commit `.env` file with actual keys
   - Use environment variables for deployment
   - Rotate keys regularly

2. **User Privacy**:
   - Messages are sent to Google's servers
   - Consider data retention policies
   - Don't send sensitive personal information

3. **Rate Limiting**:
   - Implement rate limiting in backend if needed
   - Gemini free tier has request limits
   - Monitor usage and upgrade as needed

## Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅      | ✅     |
| Firefox | ✅      | ✅     |
| Safari  | ✅      | ✅     |
| Edge    | ✅      | ✅     |

## Future Enhancements

- [ ] Voice input/output support
- [ ] File attachment support
- [ ] Conversation history persistence
- [ ] Multi-language support
- [ ] Custom AI model selection
- [ ] Analytics and usage tracking
- [ ] Integration with app actions (direct API calls)
- [ ] Conversation export/sharing

## License

Part of the Connect application. See main LICENSE file.

## Support

For issues or feature requests:
1. Check this README
2. Review browser console for errors
3. Contact development team with error details

## Changelog

### Version 1.0.0 (Initial Release)
- ✨ AI Agent Modal with chat interface
- ✨ Google Gemini integration
- ✨ Fully responsive design
- ✨ Quick actions sidebar
- ✨ Long-press header logo trigger
- ✨ Dark mode support
- ✨ Smooth animations with Framer Motion

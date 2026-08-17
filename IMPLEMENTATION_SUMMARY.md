# Chat Background Feature - Implementation Summary

## What Was Added

### Feature: Chat Background Upload & Display

Users can now upload a custom background image that appears behind all messages in the chat interface.

## Changes Made

### 1. **MessageSetting Component** (`web/src/components/setting/MessageSetting.js`)
**New Functionality:**
- File upload input for background images
- Image file validation (type and size)
- Upload handler with FormData
- Remove background button
- Background preview thumbnail
- Loading indicator during upload

**Code Structure:**
```javascript
// New state variables
const [isUploadingBackground, setIsUploadingBackground] = useState(false);
const backgroundInputRef = useRef(null);

// New handlers
handleBackgroundChange() - Validates and uploads image
handleRemoveBackground() - Removes the background
```

### 2. **Chat Component** (`web/src/pages/Chat.js`)
**New Integration:**
- Added settings selector: `const settings = useSelector(state => state.setting)`
- Applied background styles to chat-body div
- Inline styles for dynamic background image rendering

**Code Structure:**
```javascript
<div className='chat-body' style={{
    backgroundImage: settings.chatBackground ? `url('${settings.chatBackground}')` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
}}>
```

### 3. **Redux Reducer** (`web/src/services/reducers/setttingReducer.js`)
**New State Field:**
```javascript
initialState = {
    // ... existing fields
    chatBackground: null,  // New field to store background image URL
}
```

### 4. **CSS Styling** (`web/src/pages/Message.css`)
**New Styles:**
- **`.chat-body`**: Added background image properties and fixed attachment
- **`.chat-body::before`**: Semi-transparent white overlay (85% opacity) for text readability
- **`.chat-message-list`**: Added z-index layering to place messages above background

**Key CSS:**
```css
.chat-body::before {
  background: rgba(255, 255, 255, 0.85);  /* 85% white overlay */
  pointer-events: none;                     /* Prevents interaction issues */
  z-index: 0;
}

.chat-message-list {
  position: relative;
  z-index: 1;  /* Messages layer above background */
}
```

## User Interface Flow

```
Settings Tab → Message Settings Section
                ↓
        Chat Background Area
        ↓         ↓         ↓
    [Upload]  [Remove]  [Preview]
        ↓
   Image Selected
        ↓
   Validate File
   (type & size)
        ↓
   Upload to Backend
   (FormData)
        ↓
   Background Appears
   in Chat Interface
```

## Visual Effects

- **Background Image**: Displayed with cover sizing and fixed attachment for parallax effect
- **Overlay**: 85% white semi-transparent layer ensures message text is readable
- **Responsive**: Works on all screen sizes with proper background positioning

## Technical Details

### File Validation
- **Accepted Types**: PNG, JPG, GIF, WebP (checked via `file.type.startsWith('image/')`)
- **Max Size**: 5MB
- **Error Handling**: User-friendly toast notifications for validation failures

### Backend Integration
- **Endpoint**: `/setting/update` (existing endpoint)
- **Method**: POST with multipart/form-data
- **Fields**: `chatBackground` (file) or `chatBackground: null` (for removal)
- **Response**: Updated settings object with image URL

### Redux Integration
- **Action**: `loadSettings()` from `settingsActions.js`
- **Reducer**: `settingReducer` with `LOAD_SETTINGS` case
- **Selector**: `state.setting.chatBackground`

## Browser Requirements

- Modern browsers with support for:
  - CSS `backgroundAttachment: fixed`
  - FormData API
  - File input API
  - CSS Grid/Flexbox (already used in the project)

## Testing Checklist

- [ ] Upload an image from Message Settings
- [ ] Verify background appears in chat interface
- [ ] Check text readability over background
- [ ] Test background removal
- [ ] Verify file size validation (try file > 5MB)
- [ ] Verify file type validation (try non-image file)
- [ ] Test on mobile devices (responsive layout)
- [ ] Verify background persists after page reload
- [ ] Test with multiple background images

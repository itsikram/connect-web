# Chat Background Feature

## Overview
The chat background feature allows users to upload and display a custom background image in their message chat interface. The background image appears behind all chat messages and provides a personalized experience.

## Files Modified

### 1. **Frontend Components**

#### `web/src/components/setting/MessageSetting.js`
- Added chat background upload UI in the Message Settings tab
- Features:
  - File upload input (accepts PNG, JPG, GIF, WebP)
  - File size validation (max 5MB)
  - Background image preview
  - Remove button to delete the current background
  - Loading state while uploading
  - Toast notifications for success/error states

#### `web/src/pages/Chat.js`
- Imported settings selector from Redux store
- Applied background image styling to the chat body:
  - Uses `backgroundImage` CSS property
  - `backgroundSize: 'cover'` for proper scaling
  - `backgroundPosition: 'center'` for centered alignment
  - `backgroundAttachment: 'fixed'` for parallax effect during scroll

### 2. **State Management**

#### `web/src/services/reducers/setttingReducer.js`
- Added `chatBackground: null` to initial state
- Stores the background image URL returned from the backend

### 3. **Styling**

#### `web/src/pages/Message.css`
- **`.chat-body`**: Enhanced with background image CSS properties
- **`.chat-body::before`**: Added semi-transparent overlay (85% white opacity) to ensure message readability over the background image
- **`.chat-message-list`**: Added `position: relative` and `z-index: 1` to layer messages above the background

## How It Works

### Upload Flow
1. User navigates to Settings > Message Settings
2. Clicks on the "Chat Background" file input
3. Selects an image file (validated for type and size)
4. File is uploaded via API to `/setting/update` endpoint with FormData
5. Backend processes the image and returns updated settings
6. Redux state is updated with the new background URL
7. Chat interface immediately displays the new background

### Display Flow
1. `Chat.js` selects the `chatBackground` from Redux settings
2. Inline styles apply the background image to the `.chat-body` div
3. A semi-transparent white overlay (`::before` pseudo-element) provides contrast for message readability
4. Messages appear layered above the background with proper z-index

### Remove Flow
1. User clicks "Remove" button next to file input
2. API call sent with `chatBackground: null`
3. Backend updates settings
4. Background is removed from display

## API Integration

The feature requires a backend endpoint that:
- Accepts multipart/form-data uploads at `/setting/update`
- Handles `chatBackground` file field
- Returns updated settings object with the background image URL
- Supports setting `chatBackground` to `null` for removal

## User Experience Features

- **File Validation**: Only image files up to 5MB are accepted
- **Preview**: Current background is displayed with thumbnail preview
- **Loading States**: Visual feedback during upload process
- **Toast Notifications**: Success and error messages guide the user
- **Semi-transparent Overlay**: Ensures messages remain readable over any background image

## Browser Compatibility

- Modern browsers supporting:
  - CSS `backgroundAttachment: fixed`
  - CSS Grid/Flexbox
  - FormData API
  - File input with accept attribute

## Future Enhancements

Possible improvements:
- Crop/resize tool for background images
- Preset background options
- Opacity adjustment slider
- Blur effect option
- Per-contact background customization

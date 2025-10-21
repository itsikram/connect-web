# Google Sign-Up Setup Guide

## Overview
The SignUp page now includes a "Continue with Google" button that allows users to sign up using their Google account.

## Setup Instructions

### 1. Get Your Google Client ID
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `connect-2c209`
3. Navigate to **APIs & Services** > **Credentials**
4. Create a new **OAuth 2.0 Client ID** if you don't have one:
   - Application type: **Web application**
   - Name: `Connect Web Client`
   - Authorized JavaScript origins: `http://localhost:3000` (for development)
   - Authorized redirect URIs: `http://localhost:3000` (for development)
5. Copy the generated **Client ID**

### 2. Set Up Environment Variables

Create a `.env` file in the `web` directory with:

```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here
REACT_APP_SERVER_ADDR=http://localhost:5000
```

Replace `your_google_client_id_here` with your actual Google Client ID.

### 3. Server Configuration

Make sure your server has the Google Client ID configured in its environment:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 4. Features Implemented

✅ **Google Sign-In Button**: Added a styled "Continue with Google" button
✅ **OAuth Flow**: Complete Google OAuth 2.0 authentication flow
✅ **User Creation**: Automatically creates user account with Google profile data
✅ **Profile Setup**: Creates user profile with Google profile picture and name
✅ **Error Handling**: Proper error handling for failed authentication
✅ **UI Integration**: Seamlessly integrated with existing signup form
✅ **Responsive Design**: Button matches the existing design system

### 5. How It Works

1. User clicks "Continue with Google" button
2. Google OAuth popup opens for authentication
3. User grants permissions to the app
4. Google returns user profile data and ID token
5. App sends data to server for verification and user creation
6. Server creates new user account or logs in existing user
7. User is automatically logged in and redirected

### 6. Styling

The Google button is styled to match your existing design:
- Uses your primary color scheme (#29B1A9)
- Matches button height and border radius
- Includes hover effects and transitions
- Responsive design for mobile devices

### 7. Testing

To test the Google sign-up:
1. Start your development server: `npm start`
2. Navigate to the signup page
3. Click "Continue with Google"
4. Complete the Google authentication flow
5. Verify user account is created and you're logged in

### 8. Troubleshooting

**Button not appearing:**
- Check that the Google Client ID is correctly set in environment variables
- Verify the Google Identity Services script is loading (check browser console)

**Authentication errors:**
- Verify the Google Client ID matches your Google Cloud Console project
- Check that the authorized origins include your domain
- Ensure the Google+ API is enabled in your project

**Server errors:**
- Verify the server has the correct Google Client ID
- Check that the `/auth/google-signin` endpoint is working
- Ensure the server can verify Google ID tokens

## Security Notes

- The Google Client ID is safe to expose in frontend code
- Server-side verification ensures token authenticity
- User data is only stored after successful Google verification
- No sensitive data is stored in localStorage

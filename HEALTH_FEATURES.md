# Health & Fitness Features Guide

## Overview

The Health & Fitness page includes comprehensive tools for tracking weight goals, monitoring daily calorie intake, and receiving AI-powered meal suggestions using Google's Gemini API.

## Features

### 1. Weight Tracking 📊
- **Set Weight Goals**: Define your current weight and target weight
- **Choose Goal Type**: Select whether you want to lose or gain weight
- **Track Progress**: Visual progress bar showing your advancement
- **Daily Logging**: Log your weight regularly to track trends
- **Daily Notifications**: Get reminded about your weight goal progress

### 2. Calorie Tracking 🔥
- **Personalized Daily Goals**: Automatic calorie target calculation based on:
  - Age
  - Height
  - Gender
  - Activity level (Sedentary to Extremely Active)
  - Health goal (Weight Loss, Maintenance, Weight Gain)
- **Meal Logging**: Log meals with:
  - Meal name
  - Calories
  - Macronutrients (protein, carbs, fat) - optional
  - Meal type (breakfast, lunch, dinner, snack)
- **Visual Tracking**: Real-time calorie consumption progress bar
- **Meal History**: View all meals logged today with quick removal option

### 3. AI-Powered Meal Suggestions 🤖
- **Smart Recommendations**: Get 3 personalized meal suggestions based on:
  - Remaining daily calories
  - Current meal type
  - Health goal
  - Dietary preferences
- **Nutritional Details**: Each suggestion includes:
  - Calorie count
  - Macronutrient breakdown
  - Description
  - Preparation time
  - Health benefits
- **One-Click Usage**: Use suggested meals and automatically fill in your meal form
- **Expert Tips**: Get nutrition tips tailored to your situation

### 4. Push Notifications 📱
- **Weight Reminders**: Daily reminders at 9 AM about weight goal progress
- **Calorie Alerts**: Notifications when you need to eat or calories are running low
- **Smart Messages**: Context-aware notifications based on:
  - Calories consumed vs. target
  - Remaining calories
  - Completion percentage
  - Meal frequency

### 5. Daily Wellness Checklist ✓
- **Habit Tracking**: Log daily healthy habits
- **Progress Scoring**: See your daily wellness score percentage
- **Persistent Tracking**: Habits are saved per day

### 6. Fitness Knowledge Hub 📚
- **Expert Articles**: Browse fitness categories (Basics, Nutrition, Training, Recovery, etc.)
- **Actionable Advice**: Expand articles to read detailed tips
- **Daily Tips**: Get a rotating "Tip of the Day" for quick inspiration

## Setup Instructions

### 1. Get Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com)
2. Click "Get API Key" in the left panel
3. Click "Create API Key"
4. Copy your API key

### 2. Configure Environment Variables

Add to your `.env` file:

```env
REACT_APP_GEMINI_API_KEY=your_api_key_here
```

For example:
```env
REACT_APP_GEMINI_API_KEY=AIzaSyC1234567890abcdefghijklmnopqrst
```

### 3. Set Up Weight Tracking

1. Navigate to Health & Fitness page
2. Click "Start Tracking" on the Weight Goal card
3. Fill in:
   - Current Weight (kg)
   - Target Weight (kg)
   - Goal Type (Lose/Gain)
4. Click "Save Goal"
5. Log daily weight to track progress

### 4. Set Up Calorie Tracking

1. Click "Start Tracking" on the Daily Calories card
2. Fill in your profile:
   - Age
   - Height (cm)
   - Gender
   - Activity Level
   - Health Goal
   - Dietary Preferences (optional)
3. Click "Save Profile"
4. Your daily calorie target will be automatically calculated

### 5. Enable Notifications

1. Click "Enable Notifications" button on either weight or calorie card
2. Browser will ask for permission - approve it
3. You'll receive daily reminders at 9 AM

## How to Use

### Logging Meals

1. Click "Log Meal" button in the Daily Calories section
2. Enter:
   - Meal name
   - Calories
   - Meal type (optional)
   - Macros (optional) - expand "Add Macros (Optional)"
3. Either click "Log" to save or "Get AI Suggestions" for recommendations

### Getting AI Meal Suggestions

1. In the meal logging form, click "Get AI Suggestions"
2. AI will generate 3 personalized meal options based on:
   - Your remaining daily calories
   - Your health goal
   - Your dietary preferences
3. Click "Use This" on any suggestion to auto-fill the meal form
4. Click "Log" to save the meal

### Tracking Progress

- **Weight Progress**: Check the progress bar on the weight card
- **Calorie Progress**: Monitor the calorie bar and consumed/target display
- **Daily Score**: See overall wellness score percentage
- **Statistics**: Stats row shows all key metrics at a glance

### Managing Meals

- **View Meals**: All logged meals appear in "Today's Meals" section
- **Remove Meals**: Click the trash icon on any meal to delete it
- **Edit Meals**: Remove and re-log if changes are needed

### Editing Profiles

- **Weight Goal**: Click "Edit Goal" to update weight targets
- **Calorie Profile**: Click "Edit Profile" to adjust age, activity level, etc.

## Data Storage

All data is stored locally in your browser:

- **Weight Goals**: `connectWeightTarget`
- **Weight Logs**: `connectWeightLog`
- **Calorie Target**: `connectCalorieTarget`
- **User Profile**: `connectUserProfile`
- **Meal Logs**: `connectMealLog` (per-day basis)
- **Notification Settings**: `connectNotifications`
- **Wellness Checklist**: `connectHealthWellness`

## Notification Timing

- **Schedule**: Daily notifications at 9:00 AM
- **Types**:
  - Weight goal progress updates
  - Calorie intake reminders
  - Smart suggestions based on remaining calories
- **Requirements**:
  - Notification permission granted
  - At least one goal set
  - Notifications enabled in settings

## API Integration

### Gemini API Usage

The health page uses Gemini API for:

1. **Meal Suggestions**: 
   - Endpoint: `generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
   - Temperature: 0.7 (creative but accurate)
   - Max tokens: 1024

2. **Calorie Analysis** (available for future use):
   - Analyzes dietary patterns
   - Provides personalized recommendations
   - Suggests meal timing

### API Limits

- Free tier: 60 requests per minute
- Monthly limits: Check your Google Cloud console
- Cost: Free (as of latest update)

## Tips for Best Results

1. **Consistent Logging**: Log meals immediately for accuracy
2. **Include Macros**: Adding protein, carbs, fat helps AI give better suggestions
3. **Set Realistic Goals**: Use the calculated daily target as a baseline
4. **Vary Meals**: Try different meal suggestions to discover new recipes
5. **Review Daily**: Check your progress each morning
6. **Adjust Activity**: Update activity level if your routine changes

## Troubleshooting

### "API key not configured"
- Check your `.env` file has `REACT_APP_GEMINI_API_KEY`
- Verify the key is correct
- Restart your development server after adding the key

### No meal suggestions appearing
- Check browser console for errors
- Verify you have remaining calories (not at 0)
- Check API quota isn't exceeded
- Ensure you're not offline

### Notifications not working
- Check browser notification permissions
- Ensure "Notifications On" button is active
- Some browsers block notifications - check settings
- Try refreshing the page

### Data not persisting
- Check browser's localStorage is enabled
- Verify browser isn't in private/incognito mode
- Clear cache if experiencing issues
- Data is saved locally only (not synced)

## Mobile Optimization

The Health page is fully responsive and optimized for:
- iPhone (safe areas respected)
- Android devices
- Tablets in landscape/portrait
- Desktop browsers

All features work seamlessly across devices with touch-friendly buttons.

## Future Enhancements

Potential features for future versions:
- Export daily reports (PDF/CSV)
- Sync data to cloud
- Social sharing of milestones
- Recipe database integration
- Barcode scanning for quick meal logging
- Water intake tracking
- Exercise logging and calorie burn tracking
- Advanced analytics and trends

## Support

For issues or questions:
1. Check this documentation first
2. Review browser console for error messages
3. Verify API key configuration
4. Check browser network tab for API failures
5. Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)

---

**Last Updated**: 2024
**Version**: 1.0

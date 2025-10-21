# Facebook-Style Comment System - Visual Guide

## 🎨 Design Comparison

### Comment Structure

```
┌─────────────────────────────────────────────────────────┐
│  ●  John Doe                                            │
│     ╭──────────────────────────────────────╮            │
│     │ This is a great post! Thanks for    │            │
│     │ sharing this information.            │            │
│     ╰──────────────────────────────────────╯            │
│     Like · Reply · 2 hours ago                         │
│                                                          │
│     ●  Jane Smith                        [REPLY]        │
│        ╭───────────────────────────────╮                │
│        │ I agree completely!           │                │
│        ╰───────────────────────────────╯                │
│        Like · Reply · 1 hour ago                        │
└─────────────────────────────────────────────────────────┘
```

### Anatomy of a Comment

```
┌── Profile Picture (32px × 32px, circular)
│   ┌── Comment Bubble (rounded, 18px radius)
│   │   ┌── Author Name (13px, bold)
│   │   │   ┌── Comment Text (15px)
│   │   │   │
●   ╭───────────────────────────────╮
    │ John Doe                      │ ← Bubble Background (#f0f2f5)
    │ This is my comment...         │
    ╰───────────────────────────────╯
    Like · Reply · 2 hours ago
    └─┬─┘   └─┬──┘   └────┬────┘
      │       │           └── Time (12px, gray)
      │       └── Action Button (12px, bold, hover effect)
      └── Like Button (12px, bold, turns blue when liked)
```

### Loading States - Visual Flow

#### 1. Skeleton Loader
```
┌─────────────────────────────────────────────────┐
│  ◉  ╭─────────────────╮                         │ ← Shimmer effect
│     │░░░░░░░░░░░░░░░░░│   Author name           │    moves left to right
│     │░░░░░░░░░░░░░░░░░░░░░░░│  Comment text   │
│     ╰───────────────────────╯                   │
│     ░░░  ░░░░░  ░░░░░░░░                       │ ← Action buttons
└─────────────────────────────────────────────────┘
```

#### 2. Typing Comment
```
┌─────────────────────────────────────────────────┐
│  ●  ╭─────────────────────────────────────────╮ │
│     │ Write a comment...  ⋯ Posting...  📷   │ │
│     ╰─────────────────────────────────────────╯ │
│                           └─── Typing indicator │
└─────────────────────────────────────────────────┘
```

#### 3. Like Action Loading
```
┌─────────────────────────────────────────────────┐
│  ●  John Doe                                     │
│     ╭────────────────────────────────╮           │
│     │ This is a comment...           │           │
│     ╰────────────────────────────────╯           │
│     ◐ Liking... · Reply · 2 hours ago           │
│     └── Spinner + text                           │
└─────────────────────────────────────────────────┘
```

## 📐 Spacing Guide

### Desktop Layout (> 768px)
```
┌── 0px margin
│
│  ┌── 32px avatar
│  │  ┌── 8px gap
│  │  │  ┌── Comment content
│  ●  │  ╭────────────────────╮
│     │  │ Comment text...    │
│     │  ╰────────────────────╯
│     │  Like · Reply · Time
│     │
│     └── 40px indent for replies
│        ●  ╭───────────────╮
│           │ Reply text... │
│           ╰───────────────╯
│           Like · Reply · Time
└────────────────────────────────
```

### Mobile Layout (≤ 768px)
```
┌── Reduced spacing
│
│  ┌── 28px avatar (smaller)
│  │  ┌── 8px gap
│  ●  │  ╭──────────────╮
│     │  │ Comment...   │
│     │  ╰──────────────╯
│     │  Like · Reply · Time
│     │
│     └── 28px indent (reduced)
│        ●  ╭──────────╮
│           │ Reply... │
│           ╰──────────╯
└──────────────────────────
```

## 🎯 Interactive States

### Button States

#### Default State
```
Like  ← Gray text (#65676b), 12px, weight 600
```

#### Hover State
```
Like  ← Underline appears
```

#### Active/Liked State
```
Like  ← Blue text (#1877f2), weight 700
```

#### Loading State
```
◐ Liking...  ← Spinner + text, blue color
```

### Input Field States

#### Default
```
╭────────────────────────────────────────╮
│ Write a comment...              📷    │ ← #f0f2f5 background
╰────────────────────────────────────────╯
```

#### Focus
```
╭────────────────────────────────────────╮
│ Write a comment...              📷    │ ← #f2f2f2 background
╰────────────────────────────────────────╯ ← Blue shadow ring
```

#### Loading
```
╭────────────────────────────────────────╮
│ Posting comment... ⋯ Posting... 📷    │ ← Blue border
╰────────────────────────────────────────╯
           └── Typing indicator overlay
```

## 🎨 Color States

### Light Theme
```css
Background:       #ffffff (white)
Comment Bubble:   #f0f2f5 (light gray)
Text:             #050505 (near black)
Secondary Text:   #65676b (gray)
Primary (Blue):   #1877f2 (Facebook blue)
Hover:            #f2f2f2 (lighter gray)
Border:           #ced0d4 (light border)
```

### Dark Theme (if implemented)
```css
Background:       #18191a (dark)
Comment Bubble:   #3a3b3c (dark gray)
Text:             #e4e6eb (light)
Secondary Text:   #b0b3b8 (light gray)
Primary (Blue):   #1877f2 (same)
Hover:            #3a3b3c (dark gray)
Border:           #3e4042 (dark border)
```

## 📱 Responsive Breakpoints

### Extra Small (< 480px)
- Minimum spacing
- Stack long comment text
- Hide long usernames
- Compact actions

### Small (480px - 768px)
- Reduced avatar sizes
- Smaller indent
- Mobile-optimized spacing

### Medium (768px - 1024px)
- Standard sizes
- Full features
- Optimal spacing

### Large (> 1024px)
- Maximum comfortable width
- Full desktop experience
- Enhanced hover effects

## 🎬 Animation Examples

### Fade In Animation
```
Frame 1: opacity: 0, translateY: 10px  ┐
Frame 2: opacity: 0.3, translateY: 7px │ 300ms
Frame 3: opacity: 0.7, translateY: 3px │ ease-out
Frame 4: opacity: 1, translateY: 0     ┘
```

### Shimmer Effect (Skeleton)
```
Start  →  ░░▓▓▓░░░░░░░░  →  ░░░░▓▓▓░░░░  →  ░░░░░░▓▓▓░  →  End
2s loop, linear timing
```

### Typing Dots
```
Dot 1: ●○○  →  ○●○  →  ○○●  →  ●○○  (loop)
       ↑      ↑      ↑
       0s     0.2s   0.4s
Bounce up 8px, opacity 0.4 → 1 → 0.4
```

### Button Press
```
Normal  →  Hover  →  Active  →  Loading
#65676b → underline → #1877f2 → spinner
```

## 🔍 Pixel-Perfect Measurements

### Profile Pictures
```
Comment Avatar:
┌──────────┐
│          │  32px × 32px
│    ●     │  border-radius: 50%
│          │  border: 1px solid #ced0d4
└──────────┘

Reply Avatar:
┌────────┐
│    ●   │  28px × 28px
└────────┘  border-radius: 50%
```

### Comment Bubbles
```
┌─────────────────────────────┐
│ Padding: 8px 12px          │  border-radius: 18px
│ Font: 15px / 1.3333        │  background: #f0f2f5
│ Max-width: fit-content     │  min-height: 36px
└─────────────────────────────┘
```

### Input Fields
```
┌──────────────────────────────────────┐
│ Padding: 8px 12px                   │  border-radius: 20px
│ Font: 15px                          │  background: #f0f2f5
│ Min-height: 36px                    │  border: none (default)
└──────────────────────────────────────┘
```

### Action Buttons
```
Like · Reply · 2 hours ago
│      │       │
12px   12px    12px (font-size)
bold   bold    normal (font-weight)
#65    #65     #65676b (color)
676b   676b
```

## 🎭 Z-Index Layers

```
Layer 5: Modal/Dropdown     (z-index: 1000)
         Options menu
         └── .options-container

Layer 4: Loading Overlays   (z-index: 10)
         Typing indicators
         └── .comment-loading-overlay

Layer 3: Interactive        (z-index: 2)
         Hover tooltips
         └── .options-icon

Layer 2: Content            (z-index: 1)
         Comments, replies
         └── .comment-container

Layer 1: Background         (z-index: 0)
         Post background
         └── .comments
```

## 📊 Typography Scale

```
Extra Small:  11px  (Loading text on mobile)
Small:        12px  (Actions, time, secondary)
Base:         13px  (Author names)
Medium:       14px  (Mobile adjustments)
Large:        15px  (Comment text - BASE)
Extra Large:  16px  (Not used in comments)
```

### Line Heights
```
Author Name:    1.3      (13px × 1.3 = 16.9px)
Comment Text:   1.3333   (15px × 1.3333 = 20px)
Actions:        1.5      (12px × 1.5 = 18px)
```

## 🎪 Component Hierarchy

```
┌─ Post
│  ├─ Comments Section
│  │  ├─ Comment Skeleton (loading)
│  │  │  ├─ Avatar Skeleton
│  │  │  └─ Content Skeleton
│  │  │     ├─ Name Line
│  │  │     ├─ Text Lines
│  │  │     └─ Action Lines
│  │  │
│  │  ├─ Comment Container
│  │  │  ├─ Profile Picture
│  │  │  └─ Comment Info
│  │  │     ├─ Comment Box
│  │  │     │  ├─ Name + Text Bubble
│  │  │     │  └─ Options Icon (...)
│  │  │     ├─ React Actions
│  │  │     │  ├─ Like Button
│  │  │     │  ├─ Reply Button
│  │  │     │  └─ Timestamp
│  │  │     └─ Replies
│  │  │        └─ Reply Container (nested)
│  │  │
│  │  ├─ More Comments Button
│  │  └─ Loading More Indicator
│  │
│  └─ New Comment Input
│     ├─ My Profile Picture
│     └─ Input Field
│        ├─ Text Input
│        ├─ Loading Overlay
│        └─ Attachment Button
└─────────────────────────────
```

## 🚀 Performance Metrics

### Target Metrics
```
First Paint:           < 100ms
Skeleton Visible:      < 200ms
Comments Loaded:       < 500ms
Interaction Response:  < 50ms
Animation Frame Rate:  60fps
```

### Optimization Techniques
```
✅ CSS Transforms (GPU accelerated)
✅ Opacity transitions (GPU accelerated)
✅ Will-change hints for animations
✅ Debounced scroll events
✅ Throttled resize handlers
✅ Lazy image loading
✅ Virtual scrolling (for 100+ comments)
✅ React.memo() on components
✅ useCallback for event handlers
✅ useMemo for computed values
```

---

## 📸 Visual Checklist

When implementing, verify:

- [ ] Comment bubbles are rounded (18px)
- [ ] Avatars are circular with borders
- [ ] Reply indent is exactly 40px (28px mobile)
- [ ] Actions are inline with proper spacing
- [ ] Hover effects work smoothly
- [ ] Loading states are positioned correctly
- [ ] Skeleton matches real comment structure
- [ ] Colors match Facebook's palette
- [ ] Typography sizes are correct
- [ ] Animations are smooth (60fps)
- [ ] Mobile responsive works
- [ ] Focus states are visible
- [ ] High contrast mode works

---

**Visual Guide Version:** 1.0.0  
**Last Updated:** 2025  

*This guide provides visual references for the Facebook-style comment system implementation.*

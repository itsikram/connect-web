# Z-Index Hierarchy Fix

## Problem
The header right message menu was displaying below the home screen right sidebar, making it invisible to users. The issue was specifically that the menu worked in sticky header mode but not in default header mode.

## Root Cause
The z-index values were not properly organized, causing layering conflicts between:
- Header (z-index: 99)
- Right sidebar (no explicit z-index)
- Header mega menu (z-index: 99999)

Additionally, the sticky header gets `position: fixed` which creates a new stacking context, while the default header didn't have proper positioning context, causing the mega menu to be clipped or hidden.

## Solution
Implemented a proper z-index hierarchy to ensure correct layering:

### Z-Index Values (from lowest to highest):

1. **Background Elements**: z-index: -1 to 0
2. **Content Areas**: z-index: 1 to 99
3. **Sidebars**: z-index: 100
   - `#left-sidebar`: z-index: 100
   - `#right-sidebar`: z-index: 100
4. **Header**: z-index: 1000
   - `#header`: z-index: 1000
   - `.sticky-header`: z-index: 1000
5. **Header Right Menu**: z-index: 1001
   - `.header-right`: z-index: 1001
6. **Header Mega Menus**: z-index: 1002
   - `.hr-mega-menu`: z-index: 1002
   - `.header-quick-menu-item .hr-mega-menu`: z-index: 1002
   - `MegaMC` component default: z-index: 1002
7. **Dropdown Options**: z-index: 1003
   - Notification option menu: z-index: 1003
   - Message option menu: z-index: 1003
8. **Modals**: z-index: 1004
   - Modal overlays: z-index: 1004

### Changes Made:

1. **Updated Header Z-Index and Positioning**:
   ```scss
   #header {
     z-index: 1000; // Increased from 99
     position: relative; // Added positioning context
     overflow: visible; // Ensure mega menu is not clipped
   }
   
   .sticky-header {
     z-index: 1000; // Added explicit z-index
   }
   
   .header-container {
     position: relative;
     z-index: 1000;
     overflow: visible; // Ensure mega menu is not clipped
   }
   ```

2. **Added Sidebar Z-Index**:
   ```scss
   #left-sidebar {
     z-index: 100; // Added explicit z-index
   }
   
   #right-sidebar {
     z-index: 100; // Added explicit z-index
   }
   ```

3. **Enhanced Header Right Menu**:
   ```scss
   .header-right {
     z-index: 1001; // Added explicit z-index
   }
   ```

4. **Updated Mega Menu Z-Index and Positioning**:
   ```scss
   .hr-mega-menu {
     z-index: 1002 !important; // Updated from 99999
     position: absolute !important;
     top: 100% !important;
     left: 50% !important;
     transform: translateX(-50%) !important;
     opacity: 1 !important;
     visibility: visible !important;
     display: block !important;
   }
   
   .header-quick-menu-item .hr-mega-menu {
     z-index: 1002 !important; // Added explicit z-index
     position: absolute !important;
     top: 100% !important;
     margin-top: 5px !important;
   }
   
   // Ensure mega menu works in both default and sticky header states
   #header:not(.sticky-header) .hr-mega-menu,
   #header.sticky-header .hr-mega-menu {
     z-index: 1002 !important;
     position: absolute !important;
     top: 100% !important;
     left: 50% !important;
     transform: translateX(-50%) !important;
     opacity: 1 !important;
     visibility: visible !important;
     display: block !important;
   }
   ```

5. **Fixed Inline Z-Index Values**:
   - Updated `MegaMC` component default z-index from 999 to 1002
   - Updated HeaderRight message menu z-index from 9999999999999 to 1002
   - Updated HeaderRight notification menu z-index from 999999999999 to 1002
   - Updated notification option menu z-index from 99999999999999999 to 1003
   - Updated message option menu z-index from 99999999999999999 to 1002
   - Updated modal z-index from 999 to 1004

## Result
The header right message menu now properly displays above the right sidebar and all other content, ensuring it's always visible and accessible to users.

## Benefits
- ✅ Header menus are always visible
- ✅ Proper layering hierarchy established
- ✅ Consistent z-index values across components
- ✅ Better user experience with accessible navigation
- ✅ Maintainable z-index system for future components

## Best Practices for Future
1. Use z-index values in increments of 10 or 100
2. Document z-index hierarchy for new components
3. Test layering on different screen sizes
4. Avoid extremely high z-index values (like 999999999)
5. Use relative z-index values when possible

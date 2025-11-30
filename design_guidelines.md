# Design Guidelines: Data-Driven Spec Sheet Builder SaaS

## Design Approach

**Selected Approach:** Design System Hybrid (Linear + Figma-inspired)

This productivity tool requires a clean, professional interface optimized for extended work sessions. Drawing inspiration from Linear's minimal aesthetic and Figma's canvas-focused layout, we'll create an efficient, distraction-free workspace.

**Key Principles:**
- Canvas-centric layout maximizing work area
- Clear visual hierarchy between workspace and tools
- Professional, understated aesthetic
- Efficient workflows with minimal cognitive load

## Typography

**Font Stack:**
- Primary: Inter (Google Fonts) - Clean, highly legible for UI
- Monospace: JetBrains Mono - For data values and measurements

**Hierarchy:**
- Headings: 600 weight, sizes 2xl/xl/lg
- Body: 400 weight, base/sm sizes
- Labels: 500 weight, sm/xs sizes
- Data/Code: Monospace, 400 weight, sm size

## Layout System

**Spacing Primitives:** Use Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16 for consistent rhythm

**Core Layout Structure:**

1. **Header Bar** (h-14): Fixed top navigation
   - Logo/app name (left)
   - Template name/breadcrumb (center)
   - User menu + Save/Export actions (right)
   - Border bottom for separation

2. **Main Workspace** (3-panel layout):
   - **Left Sidebar** (w-64): Collapsible tools panel
   - **Center Canvas** (flex-1): Primary work area
   - **Right Sidebar** (w-80): Properties/data panel

3. **Responsive Behavior:**
   - Desktop (lg+): Full 3-panel layout
   - Tablet (md): Floating panels over canvas
   - Mobile: Stack vertically, fullscreen canvas mode

## Component Library

### Navigation & Structure

**Header Component:**
- Horizontal flex layout with justify-between
- Grouped action buttons (gap-2)
- Subtle shadow for depth
- Sticky positioning

**Sidebar Panels:**
- Smooth slide-in/out transitions
- Resize handles with drag interaction
- Collapsible sections with chevron indicators
- Scrollable content areas with subtle scrollbars

### Canvas Workspace

**Design Canvas:**
- Centered artboard with subtle shadow
- Grid overlay (toggle-able, dashed lines)
- Snap guides (colored temporary lines)
- Rulers on top and left edges
- Zoom controls (bottom-right corner)
- Pan/zoom with mouse wheel + space drag

**Canvas Controls:**
- Floating toolbar (top of canvas, semi-transparent background with blur)
- Selection handles (8-point resize, rotation handle)
- Alignment guides (smart guides appearing on drag)
- Measurement tooltips (showing dimensions during resize)

### Tool Panels

**Elements Panel (Left Sidebar):**
- Categorized accordion sections:
  - Text elements
  - Shapes
  - Images
  - Tables/Data grids
- Drag handles on each element
- Preview thumbnails (small icons + labels)
- Search/filter input at top

**Data Panel (Right Sidebar):**
- File upload area (drag-drop zone, bordered, dashed)
- Parsed headers list (chip-style tags)
- Column preview table
- Data mapping interface (drag header → canvas element)

**Properties Panel (Right Sidebar, tabs):**
- Tabs: Design | Data | Advanced
- Grouped controls with labels
- Input fields with units (px, %, pt)
- Color pickers (inline swatches)
- Font selector dropdowns
- Alignment button groups
- Spacing/padding inputs (4-value grid)

### Core UI Elements

**Buttons:**
- Primary: Rounded corners (rounded-lg), medium padding (px-4 py-2)
- Secondary: Outlined variant
- Icon-only: Square (w-9 h-9), centered icon
- Button groups: Connected with gap-0, first/last rounded

**Input Fields:**
- Consistent height (h-10)
- Rounded corners (rounded-md)
- Focus rings for accessibility
- Prefix/suffix icons where relevant
- Helper text below (text-sm)

**Dropdowns & Selects:**
- Custom styled for brand consistency
- Searchable for long lists
- Grouped options (fonts, data columns)
- Icons + text labels

**Cards:**
- Subtle borders (border)
- Rounded corners (rounded-lg)
- Padding (p-4 to p-6)
- Used for: templates, saved designs

**Modals & Overlays:**
- Centered, max-width constrained (max-w-2xl)
- Backdrop blur
- Smooth fade-in animation (200ms)
- Clear close button (top-right)

### Data Visualization

**Excel Preview Table:**
- Fixed header row
- Alternating row backgrounds for readability
- Column resize handles
- Horizontal scroll for wide data
- Compact cell padding (px-3 py-2)

**Template Gallery:**
- Grid layout (grid-cols-2 lg:grid-cols-3)
- Aspect ratio cards (aspect-video)
- Thumbnail previews
- Hover: scale transform (scale-105), shadow increase
- Template name + metadata below

### Export & Actions

**Export Panel:**
- PDF settings form
- Page size selector (dropdown)
- Quality slider
- Preview thumbnail
- Generate button (prominent, primary style)

**Toolbar Actions:**
- Icon buttons with tooltips
- Keyboard shortcuts displayed in tooltips
- Grouping with separators (border-r)
- Consistent sizing (w-9 h-9)

## Animations

**Use Sparingly:**
- Sidebar slide transitions (300ms ease-in-out)
- Element drag feedback (scale 1.05, opacity 0.8)
- Hover states (100ms transition)
- Modal fade-in/out (200ms)
- NO scroll animations, parallax, or decorative motion

## Accessibility

- Keyboard navigation for all canvas operations
- Clear focus indicators (ring-2)
- ARIA labels on icon-only buttons
- Screen reader announcements for drag operations
- High contrast mode support

## Application Flow

1. **Dashboard/Templates** (if no active design)
2. **Canvas Workspace** (main app state)
3. **Data Import Modal** (triggered action)
4. **Export Configuration** (side panel or modal)

**State Indicators:**
- Unsaved changes (dot indicator in header)
- Loading states (skeleton screens, not spinners)
- Success/error toasts (top-right, auto-dismiss)

This design prioritizes workspace efficiency, clear tool organization, and professional aesthetics suitable for extended design sessions. The interface stays out of the way while providing powerful, accessible controls when needed.
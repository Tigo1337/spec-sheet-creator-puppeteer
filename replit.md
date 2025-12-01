# SpecSheet Builder - Data-Driven Spec Sheet Builder SaaS

## Overview
SpecSheet Builder is a web-based SaaS application that allows users to create professional spec sheets by combining custom designs with data from Excel files. It's a simpler alternative to InDesign for creating data-driven documents.

## Tech Stack
- **Frontend**: React with TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js with TypeScript
- **Authentication**: Clerk (@clerk/clerk-react + @clerk/express)
- **State Management**: Zustand
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable
- **Excel Parsing**: xlsx library
- **PDF Generation**: jsPDF + html2canvas
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with custom design tokens

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── DesignCanvas.tsx    # Main canvas component
│   │   │   │   ├── CanvasElement.tsx   # Individual canvas elements
│   │   │   │   └── SelectionBox.tsx    # Element selection handles
│   │   │   ├── layout/
│   │   │   │   └── Header.tsx          # Top header with controls
│   │   │   ├── panels/
│   │   │   │   ├── LeftPanel.tsx       # Tools panel
│   │   │   │   ├── RightPanel.tsx      # Properties/Data/Export/Designs tabs
│   │   │   │   ├── PropertiesTab.tsx   # Element properties editor
│   │   │   │   ├── DataTab.tsx         # Excel upload & data fields
│   │   │   │   ├── ExportTab.tsx       # PDF export settings
│   │   │   │   └── SavedDesignsTab.tsx # User-specific saved designs
│   │   │   └── ui/                     # shadcn components
│   │   ├── lib/
│   │   │   ├── canvas-utils.ts         # Canvas helper functions
│   │   │   ├── excel-parser.ts         # Excel/CSV parsing
│   │   │   ├── queryClient.ts          # React Query client
│   │   │   └── utils.ts                # General utilities
│   │   ├── stores/
│   │   │   └── canvas-store.ts         # Zustand state management
│   │   ├── pages/
│   │   │   ├── Editor.tsx              # Main editor page
│   │   │   └── not-found.tsx           # 404 page
│   │   ├── App.tsx                     # Root component
│   │   ├── main.tsx                    # Entry point
│   │   └── index.css                   # Global styles
│   └── index.html
├── server/
│   ├── index.ts                        # Server entry point
│   ├── routes.ts                       # API routes
│   ├── storage.ts                      # In-memory storage
│   ├── objectStorage.ts                # Object storage service
│   ├── objectAcl.ts                    # Access control for objects
│   ├── vite.ts                         # Vite dev server
│   └── static.ts                       # Static file serving
├── shared/
│   └── schema.ts                       # Zod schemas & types
└── design_guidelines.md                # Design system documentation
```

## Key Features

### 1. Design Canvas
- Drag-and-drop element positioning
- Snap-to-grid functionality (10px grid)
- Zoom controls (25% - 200%)
- Element selection with resize handles
- Keyboard shortcuts (Delete, Ctrl+Z, Ctrl+A, etc.)

### 2. Element Types
- **Text**: Customizable font, size, color, weight, alignment
- **Shapes**: Rectangle, circle, line with fill, stroke, opacity
- **Images**: URL-based image display
- **Data Fields**: Excel column bindings with dynamic content

### 3. Excel Integration
- Upload .xlsx, .xls, .csv files
- Automatic header extraction
- Row preview with navigation
- Drag headers to canvas to create data bindings

### 4. PDF Export
- Page sizes: Letter, A4, Legal
- Orientation: Portrait/Landscape
- Quality slider (50% - 100%)
- Bulk export (one page per data row)

### 5. Saved Designs (Account-Specific)
- Save current canvas design with name and description
- Load previously saved designs
- Delete saved designs
- Designs are user-specific (only visible to owner)
- Uses Clerk authentication for secure access control

### 6. UI Features
- Dark/Light mode toggle
- Grid visibility toggle
- Snap-to-grid toggle
- Undo/Redo support

## API Endpoints

### Templates
- `GET /api/templates` - List all templates
- `GET /api/templates/:id` - Get single template
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Saved Designs (Authenticated)
- `GET /api/designs` - List designs for authenticated user
- `GET /api/designs/:id` - Get single design (must own)
- `POST /api/designs` - Create design for authenticated user
- `PUT /api/designs/:id` - Update design (must own)
- `DELETE /api/designs/:id` - Delete design (must own)

### Object Storage
- `GET /public-objects/:filePath` - Serve public files
- `GET /objects/:objectPath` - Serve private files
- `POST /api/objects/upload` - Get upload URL
- `PUT /api/objects/uploaded` - Process uploaded file

## Development

### Running the Application
```bash
npm run dev
```
The application runs on port 5000.

### Environment Variables
- `PUBLIC_OBJECT_SEARCH_PATHS` - Comma-separated paths for public assets
- `PRIVATE_OBJECT_DIR` - Directory for private uploads
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Object storage bucket ID

## User Preferences
- Default font: Inter
- Monospace font: JetBrains Mono
- Grid size: 10px
- Default canvas size: Letter (8.5" x 11" at 96dpi)

## Recent Changes
- Initial MVP implementation (Nov 30, 2025)
- Design canvas with drag-and-drop elements
- Excel file parsing and data binding
- PDF export functionality
- Dark/Light theme support
- Clerk authentication integration (Dec 1, 2025)
- Account-specific saved designs with secure server-side authentication

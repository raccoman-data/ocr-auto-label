# Lead-Photo Auto-Tagger

A browser-based application for auto-tagging lead-testing photos using Gemini Flash Vision, color palette extraction, and intelligent grouping.

## Features

- **Drag & Drop Upload**: Support for JPEG, PNG, and HEIC files
- **Auto Code Extraction**: Uses Gemini Flash Vision to extract sample codes (MWI.xxx, KEN.xxx)
- **Color Palette Analysis**: Client-side k-means clustering for visual similarity
- **Intelligent Grouping**: Groups unlabeled images based on time proximity and visual similarity
- **Linear-style Interface**: Clean, keyboard-first navigation with Excel-like editing
- **Always-open Sidebar**: Shows selected image preview and metadata
- **Bulk Operations**: Multi-select, drag-fill, and bulk editing capabilities

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ocr-auto-label
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npm run db:migrate
```

4. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000` with the backend running on `http://localhost:3001`.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/ui
- **Backend**: Node.js + Express + TypeScript + Prisma + SQLite
- **Image Processing**: Sharp for thumbnails and HEIC support
- **State Management**: Zustand for client-side state
- **Database**: SQLite for local data storage

## Project Structure

```
ocr-auto-label/
├── frontend/                 # React + Vite app
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── stores/          # Zustand stores
│   │   ├── lib/             # Utilities and API
│   │   └── types/           # TypeScript definitions
│   └── package.json
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── routes/          # API routes
│   │   └── index.ts         # Main server file
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
└── package.json             # Root package.json
```

## Development

### Available Scripts

- `npm start` - Start both frontend and backend
- `npm run dev:frontend` - Start only frontend dev server
- `npm run dev:backend` - Start only backend dev server
- `npm run build` - Build both frontend and backend
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Gemini API (for Phase 3)
GEMINI_API_KEY=your_gemini_api_key_here

# Database
DATABASE_URL="file:./dev.db"

# Server
PORT=3001
NODE_ENV=development
```

## Usage

1. **Upload Images**: Drag and drop image files or folders into the upload area
2. **Review Table**: Images appear in chronological order with status indicators
3. **Select Images**: Click to select individual images or use Ctrl/Cmd for multi-select
4. **View Details**: Selected image details appear in the always-open sidebar
5. **Edit Names**: Use inline editing or drag-fill to update names and groups
6. **Apply Changes**: Click Apply to save changes before export
7. **Export**: Download renamed files as a ZIP archive

## Status Icons

- 🎨 **Palette**: Color extraction status (grey → amber → green)
- 📝 **Code**: Gemini text detection status (grey → amber → green)  
- 🔗 **Grouped**: Auto-grouping status (grey → amber → green)

## Performance Targets

- **Upload Speed**: Instant table display after drag-drop
- **Palette Extraction**: < 50ms per image
- **Large Batches**: Support for 2K-10K images
- **UI Responsiveness**: Virtualized table for smooth scrolling

## License

MIT License - see LICENSE file for details 
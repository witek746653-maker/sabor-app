# Wine List Generator Tool

This is a mini-app built with React + Vite + Tailwind CSS.
It is served by the Flask backend at `/tools/wine-list-generator/`.

## Development

1. Navigate to this directory:
   ```bash
   cd tools-src/wine-list-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run dev server:
   ```bash
   npm run dev
   ```
   *Note: usage in `dev` mode might require adjusting the base path in `vite.config.js` or proxying, but for standalone UI testing it works at root.*

## Building

To build the tool for the backend:

```bash
npm run build
```

This command:
1. Builds the React app.
2. Outputs files to `../../backend/static/tools/wine-list-generator`.

## Backend Integration

The backend serves this tool via `backend/routes/static_pages.py`.
The route `/tools/<tool_id>/` maps to `backend/static/tools/<tool_id>/index.html`.

Registry entry is located at `backend/static/tools/registry.json`.

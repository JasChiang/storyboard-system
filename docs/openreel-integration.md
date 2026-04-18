# OpenReel Integration

This project embeds a self-hosted OpenReel editor for online timeline editing.

## Setup

1. Install OpenReel dependencies:

```
cd external/openreel-video
pnpm install
```

2. Start OpenReel dev server:

```
pnpm dev
```

This runs the editor at `http://localhost:5173`.

3. (Optional) Override the editor URL:

```
NEXT_PUBLIC_OPENREEL_URL=http://localhost:5173
```

## Data Flow

- The Storyboard scenes are converted into an OpenReel Project JSON file.
- The JSON is sent to OpenReel via `postMessage` and loaded into the editor.
- Clicking "保存專案" requests the current OpenReel JSON and saves it back into the project as `openreelProjectJson`.
- Video export is handled inside the OpenReel UI.

## Files

- `components/export/OpenReelEditor.tsx` - iframe host + postMessage bridge
- `lib/utils/openreel-converter.ts` - storyboard -> OpenReel project JSON
- `external/openreel-video/apps/web/src/hooks/useExternalProjectBridge.ts` - OpenReel message listener

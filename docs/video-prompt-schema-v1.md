# Video Prompt Schema v1

## Goal
Use one stable schema for video prompt generation instead of adding ad-hoc rules after failures.

## Fixed Sections
All video prompts are composed in this order:

1. `Heading`
2. `Shot goal`
3. `Camera motion`
4. `Subject state`
5. `Identity invariants`
6. `Hard negatives`

Implemented in:
- `lib/video/adapters/prompt-schema.ts`

## Model-Specific Builders
- `Kling`: `lib/video/adapters/kling.ts`
- `Seedance`: `lib/video/adapters/seedance.ts`

Both builders:
- Consolidate multi-angle reference rules before injection.
- Add camera-motion safety lines for anchored products.
- Keep text/logo constraints explicit when `ipProfile.textLogoPolicy` is set.

## Safety and Length Policy
- Frontend preflight + backend guard:
  - `lib/video/prompt-policy.ts`
  - `components/video-generation/VideoGenerator.tsx`
  - `app/api/fal/generate-video/route.ts`
- Kling hard limit: `2500` chars.
- Seedance hard limit: `4000` chars.

## Anchored Product Motion Safety
For prompts with camera-move verbs (`pan/tilt/zoom/dolly/...`), adapters add:
- camera-only motion language
- "wall-mounted product remains physically fixed" when relevant
- stable world-position guidance for non-end-frame shots
- risky handoff mitigation: when prompt asks "from product to family" without end frame, enforce limited reframe constraints to prevent object drift/fake zoom

Implemented in:
- `lib/video/adapters/motion-safety.ts`

## Reference Links
- Gemini Image Prompt Guide:
  - `https://ai.google.dev/gemini-api/docs/image-generation?hl=zh-tw#prompt-guide`
- Kling 2.6 I2V API:
  - `https://fal.ai/models/fal-ai/kling-video/v2.6/pro/image-to-video/api`
- Seedance 1.5 I2V API:
  - `https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/api`
- Seedance Prompt Guide:
  - `https://fal.ai/learn/devs/seedance-1-5-prompt-guide`
- Kling Motion Control Guide:
  - `https://fal.ai/learn/devs/kling-video-2-6-motion-control-prompt-guide`

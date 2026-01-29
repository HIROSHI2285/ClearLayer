# ClearLayer: High-Precision Background Remover

ClearLayer is a privacy-focused, browser-based image processing tool that leverages state-of-the-art AI to remove backgrounds and extract objects directly on your device.

## Key Features

- **AI Auto-Removal**: Instant background removal using machine learning models running locally in your browser.
- **AI Smart Select (Magic Wand)**: Interactive object extraction powered by the Segment Anything Model (SAM). Point and click to select what to keep or remove.
- **PowerPoint-Style Interface**: Intuitive visual overlay (purple for removed areas, transparent for kept areas) to guide your editing.
- **Privacy First**: No images are ever uploaded to a server. All processing happens locally via Web Workers and WebGPU/WASM.

## Current Technical Challenges

While the application is functional, we are actively working on the following "vibe" and technical hurdles:

1.  **AI Precision & Edge Quality**:
    - We currently use **SlimSAM**, a lightweight 77M parameter model for browser speed. While fast, it can sometimes struggle with fine details like hair or complex silhouettes compared to the full 600M+ parameter SAM models.
    - **Upscaling Artifacts**: Converting low-resolution AI masks back to original high-res dimensions is a lossy process. We are refining our `post_process_masks` logic to minimize "jagged" or "dirty" edges.

2.  **Coordinate Mapping**:
    - Mapping a user's click on a responsive UI container to a models's internal reshaped/padded 1024x1024 coordinate system is a delicate bit of math. Small rounding errors in the browser can lead to the "selection" being slightly off-center.

3.  **Performance vs. Compatibility**:
    - **WebGPU** is our preferred backend for speed, but varies by browser version. We fallback to **WASM (CPU)** for broad compatibility, which can introduce latency on high-resolution images.

## Development

### Setup

```bash
npm install
npm run dev
```

### Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + Shadcn UI
- **AI Engine**: `@huggingface/transformers` (SAM/SlimSAM)
- **Runtime**: Web Workers with OffscreenCanvas for non-blocking UI.

---
*Built with ❤️ for privacy-preserving image editing.*

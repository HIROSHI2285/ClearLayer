# ClearLayer Studio: High-Precision Background Remover

ClearLayer Studio is a professional-grade, privacy-first, browser-based image processing tool. It leverages state-of-the-art AI models to provide high-precision background removal and object extraction directly on your device.

## ✨ Key Features

- **🚀 Pro-Level Auto-Removal**: Instant background removal using **BiRefNet (Lite)** coupled with a **Guided Filter (Alpha Matting)**. Achieve Canva-quality clean edges for hair and complex silhouettes with a single click.
- **🪄 Smart Select (Next-Gen Magic Wand)**: Interactive object extraction powered by **SAM 2.1 (Segment Anything Model 2)**. Point and click to select what to keep or remove with unmatched precision.
- **🎨 Creative Tools**:
  - **Crop Tool**: Precise rectangle selection to focus on what matters.
  - **Manual Eraser**: Fine-tune your results with a manual brush for perfect transparency.
- **🔒 Privacy First**: 100% Client-Side. Your images never leave your computer. Processing happens locally via WebGPU/WASM.
- **🌈 Modern UI**: A beautiful, Canva-inspired interface with mesh gradients, glassmorphism, and a friendly UX.

## 🛠️ Security & Privacy

ClearLayer Studio is hardened for secure deployment:
- **Strict Content Security Policy (CSP)**: Blocks XSS and unauthorized data exfiltration.
- **Cross-Origin Isolation**: Uses COOP/COEP for secure Web Worker communication and performance.
- **HSTS & Secure Headers**: Includes HSTS, X-Frame-Options, and X-Content-Type-Options.
- **Permissions-Policy**: Explicitly blocks camera, microphone, and geolocation.

## 🚀 Getting Started

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```

3. **Open Browser**:
   Visit [http://localhost:3000](http://localhost:3000).

### Deployment

To deploy as a static site (recommended for maximum security):

1. **Build the Project**:
   ```bash
   npm run build
   ```

2. **Output**:
   The static files will be in the `out` directory, ready to be hosted on Vercel, S3, or any static host.

## 🏗️ Technical Stack

- **Frontend**: Next.js 15 (App Router), React 19
- **Styling**: Tailwind CSS 4, Lucide Icons
- **AI Engine**: `@huggingface/transformers`
- **Models**: 
  - `briaai/RMBG-2.0` (for auto-removal logic)
  - `facebook/sam2.1-hiera-tiny` (for smart selection)
- **Runtime**: Web Workers with OffscreenCanvas.

---
*Built with ❤️ for privacy-preserving, high-precision image editing.*

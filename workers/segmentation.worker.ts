import { pipeline, env, RawImage } from '@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton for the model
let segmenter: any = null;

async function loadModel() {
    if (segmenter) {
        self.postMessage({ status: 'ready', message: 'Ready (Cached)' });
        return;
    }

    console.log("Loading Stable High-Res Engine (RMBG-1.4 + Transparency)...");
    self.postMessage({ status: 'loading', message: 'Loading Stable Engine...' });

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 25000));

    try {
        // [PLAN B: Transparency Support]
        // Reverting to stable RMBG-1.4 but enabling Alpha Preservation.
        segmenter = await Promise.race([
            pipeline('image-segmentation', 'briaai/RMBG-1.4', {
                device: 'webgpu', // Try GPU first
            }),
            timeout
        ]);
        console.log("RMBG-1.4 Loaded (WebGPU)");
        self.postMessage({ status: 'ready', message: 'Ready (High-Res Mode)' });
    } catch (e: any) {
        console.warn("WebGPU failed, trying WASM...", e);
        try {
            segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
                device: 'wasm',
            });
            self.postMessage({ status: 'ready', message: 'Ready (Compatibility Mode)' });
        } catch (e2: any) {
            console.error("All backends failed", e2);
            self.postMessage({ status: 'error', error: `AI Init Failed: ${e2.message}` });
        }
    }
}

// --- High-Performance Guided Filter ---
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
    const dest = new Float32Array(src.length);
    const iarr = 1 / (2 * r + 1);

    // Horizontal pass
    for (let i = 0; i < h; i++) {
        let ti = i * w;
        let li = ti;
        let ri = ti + r;
        const fv = src[ti];
        const lv = src[ti + w - 1];
        let val = (r + 1) * fv;

        for (let j = 0; j < r; j++) val += src[ti + j];

        for (let j = 0; j <= r; j++) {
            val += src[ri++] - fv;
            dest[ti++] = val * iarr;
        }

        for (let j = r + 1; j < w - r; j++) {
            val += src[ri++] - src[li++];
            dest[ti++] = val * iarr;
        }

        for (let j = w - r; j < w; j++) {
            val += lv - src[li++];
            dest[ti++] = val * iarr;
        }
    }

    // Vertical pass
    const destFinal = new Float32Array(src.length);
    for (let i = 0; i < w; i++) {
        let ti = i;
        let li = ti;
        let ri = ti + r * w;
        const fv = dest[ti];
        const lv = dest[ti + w * (h - 1)];
        let val = (r + 1) * fv;

        for (let j = 0; j < r; j++) val += dest[ti + j * w];

        for (let j = 0; j <= r; j++) {
            val += dest[ri] - fv;
            destFinal[ti] = val * iarr;
            ri += w;
            ti += w;
        }

        for (let j = r + 1; j < h - r; j++) {
            val += dest[ri] - dest[li];
            destFinal[ti] = val * iarr;
            li += w;
            ri += w;
            ti += w;
        }

        for (let j = h - r; j < h; j++) {
            val += lv - dest[li];
            destFinal[ti] = val * iarr;
            li += w;
            ti += w;
        }
    }
    return destFinal;
}

function guidedFilter(I: Float32Array, p: Float32Array, w: number, h: number, r: number, eps: number): Float32Array {
    const meanI = boxBlur(I, w, h, r);
    const meanP = boxBlur(p, w, h, r);
    const meanIp = boxBlur(I.map((v, i) => v * p[i]), w, h, r);
    const meanII = boxBlur(I.map(v => v * v), w, h, r);

    const a = new Float32Array(w * h);
    const b = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
        const varI = meanII[i] - meanI[i] * meanI[i];
        const covIp = meanIp[i] - meanI[i] * meanP[i];
        a[i] = covIp / (varI + eps);
        b[i] = meanP[i] - a[i] * meanI[i];
    }

    const meanA = boxBlur(a, w, h, r);
    const meanB = boxBlur(b, w, h, r);

    const q = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        q[i] = meanA[i] * I[i] + meanB[i];
    }
    return q;
}

self.onmessage = async (e: MessageEvent) => {
    const { image, id, command } = e.data;

    if (command === 'preload') {
        await loadModel();
        return;
    }

    if (!image || !id) return;

    try {
        if (!segmenter) await loadModel();
        if (!segmenter) throw new Error("AI Engine not initialized");

        self.postMessage({ status: 'processing', id, message: 'Processing Image...' });

        // 1. Prepare Inputs
        const originalBitmap = await createImageBitmap(image);
        const w = originalBitmap.width;
        const h = originalBitmap.height;

        // 2. Inference (RMBG-1.4)
        const inputRaw = await RawImage.read(image);
        const result = await segmenter(inputRaw);

        // Output from RMBG is a mask
        const maskOutput = result.mask || (Array.isArray(result) && result[0].mask) || result;
        if (!maskOutput) throw new Error("Inference failed");

        // 3. Upscale Mask & Prepare Guidance (The "Canva Secret Sauce")
        self.postMessage({ status: 'processing', id, message: 'Refining Transparency...' });

        // Guidance I (Grayscale/Luminance) from Original High-Res
        const guideCanvas = new OffscreenCanvas(w, h);
        const guideCtx = guideCanvas.getContext('2d', { willReadFrequently: true });
        if (!guideCtx) throw new Error("Canvas init failed");
        guideCtx.drawImage(originalBitmap, 0, 0);
        const guideData = guideCtx.getImageData(0, 0, w, h);

        const I = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            I[i] = (guideData.data[i * 4] * 0.299 + guideData.data[i * 4 + 1] * 0.587 + guideData.data[i * 4 + 2] * 0.114) / 255.0;
        }

        // Prepare Input P (The AI Mask, resized to native)
        const maskCanvas = new OffscreenCanvas(maskOutput.width, maskOutput.height);
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) throw new Error("Mask canvas failed");
        const maskImgData = new ImageData(
            new Uint8ClampedArray(maskOutput.data.length * 4),
            maskOutput.width,
            maskOutput.height
        );
        for (let i = 0; i < maskOutput.data.length; i++) {
            const val = maskOutput.data[i * (maskOutput.channels || 1)];
            maskImgData.data[i * 4] = val;
            maskImgData.data[i * 4 + 1] = val;
            maskImgData.data[i * 4 + 2] = val;
            maskImgData.data[i * 4 + 3] = 255;
        }
        maskCtx.putImageData(maskImgData, 0, 0);

        const pCanvas = new OffscreenCanvas(w, h); // Resize to native
        const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
        if (!pCtx) throw new Error("pCanvas failed");
        pCtx.drawImage(maskCanvas, 0, 0, w, h);
        const pData = pCtx.getImageData(0, 0, w, h);

        const p = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            // [TRANSPARENCY SUPPORT]
            // Instead of binarizing (0 or 1), we keep the soft alpha probabilities.
            // This allows the Guided Filter to refine the *gradients* of transparency (e.g. glass, hair)
            // using the local structure of the image (I).
            p[i] = pData.data[i * 4] / 255.0;
        }

        // 4. Run Guided Filter
        // Radius matches local detail size.
        const adaptiveRadius = Math.max(2, Math.round(Math.min(w, h) / 150)); // Slightly tighter radius for details
        const refinedAlpha = guidedFilter(I, p, w, h, adaptiveRadius, 1e-4);

        // 5. Final Composite
        const finalRgba = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) {
            finalRgba[i * 4] = guideData.data[i * 4];
            finalRgba[i * 4 + 1] = guideData.data[i * 4 + 1];
            finalRgba[i * 4 + 2] = guideData.data[i * 4 + 2];

            // Gamma correction for Alpha to boost solid areas while keeping transparency
            // x^0.5 makes midtops (0.5) -> 0.7, boosting visibility of semi-transparent areas
            // x^2 makes them more transparent.
            // We want to trust the AI but clean up noise.

            let a = refinedAlpha[i];

            // Soft thresholding to remove dusty background noise
            if (a < 0.05) a = 0;

            // We do NOT force >0.8 to 1.0 anymore. 
            // We allow the Guided Filter's result to stand, which preserves texture in hair/glass.

            finalRgba[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
        }

        const finalCanvas = new OffscreenCanvas(w, h);
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) throw new Error("Final canvas failed");
        finalCtx.putImageData(new ImageData(finalRgba, w, h), 0, 0);

        const resultBlob = await finalCanvas.convertToBlob({ type: 'image/png' });
        self.postMessage({ status: 'complete', id, result: resultBlob });

    } catch (e: unknown) {
        console.error("Worker Error Details:", e);
        const errorMsg = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : typeof e === 'string' ? e : JSON.stringify(e);
        self.postMessage({ status: 'error', id, error: errorMsg });
    }
};

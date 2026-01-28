import { pipeline, env, RawImage } from '@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton for the model
let segmenter: any = null;

async function loadModel() {
    if (segmenter) return;

    console.log("Loading model...");
    self.postMessage({ status: 'loading', message: 'Loading model (approx. 100MB)...' });

    try {
        segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
            device: 'webgpu', // Force WebGPU
        });
        console.log("Model loaded");
        self.postMessage({ status: 'ready', message: 'Model ready' });
    } catch (e: any) {
        console.error("Model load failed", e);
        self.postMessage({ status: 'error', error: `Model load failed: ${e.message}`, id: 'system' });
    }
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
        if (!segmenter) throw new Error("Segmenter not initialized");

        self.postMessage({ status: 'processing', id, message: 'Removing background...' });

        // 1. Read input image for inference
        const inputImage = await RawImage.read(image);

        // 2. Run inference
        // 2. Run inference
        const result = await segmenter(inputImage);

        let mask = null;
        if (result && result.mask) {
            mask = result.mask;
        } else if (Array.isArray(result) && result.length > 0 && result[0].mask) {
            mask = result[0].mask;
        } else {
            mask = result;
        }

        if (!mask) throw new Error("Result is null (check model output)");

        // Defensive check for RawImage-like object
        const maskW = mask.width;
        const maskH = mask.height;
        const maskData = mask.data;
        const channels = mask.channels || 1;

        if (!maskW || !maskH || !maskData) {
            const keys = Object.keys(mask || {});
            throw new Error(`Invalid mask object keys: ${keys.join(', ')}. Result type: ${typeof result}`);
        }

        // 3. Composite (Apply Mask)
        // Set up main canvas with Original Image dimensions
        // We use the original Blob (image) to create the bitmap to avoid RawImage conversion issues
        const originalBitmap = await createImageBitmap(image);
        const width = originalBitmap.width;
        const height = originalBitmap.height;

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        // Draw original image
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(originalBitmap, 0, 0);

        // 4. Prepare Mask Bitmap
        // Manually create ImageData from mask pixels via OffscreenCanvas
        // reuse vars defined above

        // Create RGBA buffer for the mask
        // We want the mask value (white=subject) to become the Alpha of the final image
        // Strategy: Create a mask image where Alpha = MaskValue.
        // Then use 'destination-in' composite. 
        const maskRgbaData = new Uint8ClampedArray(maskW * maskH * 4);

        for (let i = 0; i < maskW * maskH; i++) {
            // Get mask pixel value (assuming grayscale/1-channel or taking R from RGB)
            const val = maskData[i * channels];

            // Set R,G,B to 0 (doesn't matter for destination-in)
            maskRgbaData[i * 4 + 0] = 0;
            maskRgbaData[i * 4 + 1] = 0;
            maskRgbaData[i * 4 + 2] = 0;
            // Set Alpha to the mask value
            maskRgbaData[i * 4 + 3] = val;
        }

        const maskImageData = new ImageData(maskRgbaData, maskW, maskH);

        // Put mask on a temporary canvas so we can draw it scaled if needed
        const maskCanvas = new OffscreenCanvas(maskW, maskH);
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) throw new Error("Could not get mask canvas context");
        maskCtx.putImageData(maskImageData, 0, 0);

        // 5. Apply Mask
        ctx.globalCompositeOperation = 'destination-in';
        // Draw mask stretched to fit the original image (handles potential model resizing)
        ctx.drawImage(maskCanvas, 0, 0, width, height);

        // 6. Output
        const outputBlob = await canvas.convertToBlob({ type: 'image/png' });

        self.postMessage({
            status: 'complete',
            id,
            result: outputBlob,
        });

    } catch (error: any) {
        console.error("Processing failed", error);
        self.postMessage({ status: 'error', id, error: error.message });
    }
};

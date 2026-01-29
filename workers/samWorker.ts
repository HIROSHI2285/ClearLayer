import { env, Sam2Model, AutoProcessor, RawImage, Tensor } from '@huggingface/transformers';

// Skip local checks via env
env.allowLocalModels = false;
env.useBrowserCache = true;

interface SamWorkerMessage {
    command: 'preload' | 'encode' | 'decode';
    id?: string;
    uuid?: string;
    image?: Blob | File;
    points?: number[]; // [x1, y1, x2, y2, ...]
    labels?: number[]; // [1, 0, 1, 0...] 1=positive, 0=negative
}

// Singleton for the model and processor
let model: any = null;
let processor: any = null;

// Store image embeddings: uuid -> embeddings
const embeddingsMap = new Map<string, any>();

async function loadModel() {
    if (model) return;

    console.log("Loading SAM 2.1 Model...");
    self.postMessage({ status: 'loading', message: 'Loading SAM 2.1 Model (approx. 100MB)...' });

    // Use onnx-community version for guaranteed compatibility with Transformers.js v3
    const modelId = 'onnx-community/sam2.1-hiera-tiny-ONNX';

    try {
        model = await Sam2Model.from_pretrained(modelId, {
            dtype: 'fp32',
            device: 'wasm', // WASM is safer in workers for now
        });

        processor = await AutoProcessor.from_pretrained(modelId);

        self.postMessage({ status: 'ready', message: 'SAM 2.1 (Hiera-Tiny) Loaded' });
    } catch (e: any) {
        console.error("SAM 2 loading failed", e);
        self.postMessage({ status: 'error', error: `SAM 2.1 Load Failed: ${e.message}.` });
    }
}

self.onmessage = async (e: MessageEvent<SamWorkerMessage>) => {
    const { command, id, uuid, image, points, labels } = e.data;

    try {
        if (command === 'preload') {
            await loadModel();
        }

        else if (command === 'encode') {
            if (!model || !processor || !image || !uuid) return;

            const rawImage = await RawImage.fromBlob(image);
            const inputs = await processor(rawImage);
            const image_embeddings = await model.get_image_embeddings(inputs);

            embeddingsMap.set(uuid, {
                image_embeddings,
                original_sizes: inputs.original_sizes,
                reshaped_input_sizes: inputs.reshaped_input_sizes,
            });

            // Cleanup loaded image to save memory? (No, RawImage handles it)

            self.postMessage({ status: 'encoded', uuid });
        }

        else if (command === 'decode') {
            const { uuid, points, labels, sensitivity = 0.5, maskIndex = -1 } = e.data as any;
            if (!model || !processor || !uuid || !embeddingsMap.has(uuid)) return;

            const embeddingData = embeddingsMap.get(uuid);
            const [originalH, originalW] = embeddingData.original_sizes[0];
            const [reshapedH, reshapedW] = embeddingData.reshaped_input_sizes[0];

            const scaleX = reshapedW / originalW;
            const scaleY = reshapedH / originalH;

            // Prepare points
            let finalPoints = points ? [...points] : [];
            let finalLabels = labels ? [...labels] : [];

            // Feature: Automatic Background Anchors
            // If the user hasn't added any "Remove" (0) points, add corners as context
            if (!finalLabels.includes(0) && finalPoints.length > 0) {
                // Add 4 corners as implicit background (Red points)
                // Using 0,0 0,W W,0 W,W
                finalPoints.push([0, 0], [originalW - 1, 0], [0, originalH - 1], [originalW - 1, originalH - 1]);
                finalLabels.push(0, 0, 0, 0);
            }

            const scaledPoints = finalPoints.map((p: any) => [
                Math.round(p[0] * scaleX),
                Math.round(p[1] * scaleY)
            ]);

            // SAM-vit-base expects [batch_size, num_queries, num_points, 2] 
            // and [batch_size, num_queries, num_points]
            const input_points = new Tensor('float32', scaledPoints.flat(), [1, 1, scaledPoints.length, 2]);
            const input_labels = new Tensor('int64', new BigInt64Array(finalLabels.map(l => BigInt(l))), [1, 1, finalLabels.length]);

            const samInputs = {
                ...embeddingData.image_embeddings,
                input_points,
                input_labels,
            }

            const outputs = await model(samInputs);

            // Post-process the masks using the processor to get high-res masks in original resolution
            // We use the processor's post_process_masks which handles the padding and rescaling.
            const masks = await (processor as any).post_process_masks(
                outputs.pred_masks,
                embeddingData.original_sizes,
                embeddingData.reshaped_input_sizes
            );

            // Extract the best mask
            const iou_scores = outputs.iou_scores ? outputs.iou_scores.data : outputs.iou_predictions.data;
            let bestIndex = iou_scores.indexOf(Math.max(...iou_scores));

            // Allow manual override of mask index (for Detail/Wide modes)
            if (maskIndex >= 0 && maskIndex < (outputs.pred_masks.dims[1] || 1)) {
                bestIndex = maskIndex;
            }

            const bestMask = (masks[0] as any);
            const dims = bestMask.dims;
            // Shape: [num_masks, H, W] or [1, num_masks, H, W]
            const maskW = dims[dims.length - 1];
            const maskH = dims[dims.length - 2];
            const numChannels = dims.length > 2 ? dims[dims.length - 3] : 1;

            const [targetH, targetW] = embeddingData.original_sizes[0];

            console.log(`[SAM Worker] Mask Dims: ${dims.join('x')}, Target: ${targetW}x${targetH}, Best Index: ${bestIndex}, Sensitivity: ${sensitivity}`);
            console.log(`[SAM Worker] Best Mask Tensor Shape: ${bestMask.dims.join('x')}, Data Length: ${bestMask.data.length}`);

            // Create canvases at controlled resolution
            const maskCanvas = new OffscreenCanvas(targetW, targetH);
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) throw new Error("No maskCtx");

            const rawMaskCanvas = new OffscreenCanvas(targetW, targetH);
            const rawMaskCtx = rawMaskCanvas.getContext('2d');
            if (!rawMaskCtx) throw new Error("No rawMaskCtx");

            const imgData = maskCtx.createImageData(targetW, targetH);
            const rawImgData = rawMaskCtx.createImageData(targetW, targetH);

            const maskStride = maskH * maskW;
            const channelOffset = Math.min(bestIndex, numChannels - 1) * maskStride;
            const data = bestMask.data;

            const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

            // Feature: Smoothness (Sharpness)
            // Higher smoothness = softer transition. Lower = sharper (Canva style).
            // Default 0.5 -> temp = 1.0. Sensitivity moves the threshold.
            const smoothness = (e.data as any).smoothness ?? 0.5;
            const temperature = 1.0 / (0.1 + smoothness * 2.0); // Map 0.5 to ~1.0, lower to be sharper

            // Use 2D loop with explicit check against TENSOR dimensions vs TARGET dimensions
            for (let y = 0; y < targetH; y++) {
                for (let x = 0; x < targetW; x++) {
                    const pixelIdx = (y * targetW + x) * 4;

                    let logit = -10.0;
                    if (y < maskH && x < maskW) {
                        // Correct indexing: [channel, y, x] flattened
                        const tensorIdx = channelOffset + (y * maskW + x);
                        if (tensorIdx < data.length) {
                            logit = data[tensorIdx];
                        }
                    }

                    // Apply temperature for sharpness control
                    const prob = sigmoid(logit * temperature);
                    // Use sensitivity as the threshold
                    const isForeground = prob > 0.5; // Since we moved threshold via sensitivity? 
                    // Wait, sensitivity should be the PRECISE point where we cut.
                    const adjustedProb = sigmoid((logit - (sensitivity * 20 - 10)) * temperature);
                    const isVisible = adjustedProb > 0.5;

                    // Display Overlay (Magenta for background)
                    if (isVisible) {
                        imgData.data[pixelIdx + 3] = 0; // Transparent (Foreground)
                    } else {
                        imgData.data[pixelIdx + 0] = 219;
                        imgData.data[pixelIdx + 1] = 39;
                        imgData.data[pixelIdx + 2] = 239;
                        imgData.data[pixelIdx + 3] = 180;
                    }

                    // Raw Mask (Alpha = Remove percentage)
                    rawImgData.data[pixelIdx + 0] = 0;
                    rawImgData.data[pixelIdx + 1] = 0;
                    rawImgData.data[pixelIdx + 2] = 0;

                    // Final Cut Logic - ALIGNED WITH VISUALS (Fix "Purple Area" Residue)
                    // Visual Overlay threshold is 0.5. Anything below 0.5 is shown as "Purple".
                    // We must ensure that ANYTHING visible as "Purple" is 100% removed.

                    let finalAlpha = 0;

                    // If probability is < 0.55 (Background/Purple + small buffer), FORCE COMPLETE REMOVAL (255).
                    if (adjustedProb < 0.55) {
                        finalAlpha = 255;
                    }
                    // If probability is high (Foreground), keep it solid (0).
                    else if (adjustedProb > 0.7) {
                        finalAlpha = 0;
                    }
                    // Only anti-alias the very tight edge (0.55 - 0.7)
                    else {
                        finalAlpha = Math.round((1.0 - adjustedProb) * 255);
                    }

                    rawImgData.data[pixelIdx + 3] = finalAlpha;
                }
            }

            maskCtx.putImageData(imgData, 0, 0);
            rawMaskCtx.putImageData(rawImgData, 0, 0);

            const blob = await maskCanvas.convertToBlob();
            const rawBlob = await rawMaskCanvas.convertToBlob();

            self.postMessage({ status: 'decoded', uuid, mask: blob, rawMask: rawBlob });
        }

    } catch (err: any) {
        console.error(err);
        self.postMessage({ status: 'error', error: err.message, id });
    }
};

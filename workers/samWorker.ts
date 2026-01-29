
import { env, SamModel, AutoProcessor, RawImage, Tensor } from '@huggingface/transformers';

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
    embeddings?: any;
}

let model: any = null;
let processor: any = null;

// Store image embeddings: uuid -> embeddings
const embeddingsMap = new Map<string, any>();

async function loadModel() {
    if (model) return;
    console.log("Loading SAM Model...");

    // Use a lightweight SAM model suitable for browser
    // Use SlimSAM (Proven compatibility with transformers.js)
    const modelId = 'Xenova/slimsam-77-uniform';

    model = await SamModel.from_pretrained(modelId, {
        dtype: 'fp32',
        device: 'wasm', // 'wasm' is the correct backend for CPU
    });

    processor = await AutoProcessor.from_pretrained(modelId);

    // Send ready signal
    self.postMessage({ status: 'ready', message: 'SAM Model Loaded' });
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
                orig_height: rawImage.height,
                orig_width: rawImage.width,
                input_height: inputs.pixel_values.dims[2],
                input_width: inputs.pixel_values.dims[3]
            });

            // Cleanup loaded image to save memory? (No, RawImage handles it)

            self.postMessage({ status: 'encoded', uuid });
        }

        else if (command === 'decode') {
            if (!model || !processor || !uuid || !embeddingsMap.has(uuid)) return;

            const embeddingData = embeddingsMap.get(uuid);

            // Prepare points for input
            // points input should be shape [1, N, 2]
            // labels input should be shape [1, N]

            // Xenova/transformers.js SAM implementation might vary slightly in input format
            // We use the processor/model typically.

            // Actually for decoder-only inference with embeddings, we directly call the model
            // but passing the embeddings as inputs.

            // The library evolves, let's try the standard way:

            // Rescale points to input dimensions
            // Note: transformations are usually handled by processor, but since we are doing manual embedding loop...
            // Use the processor to format points if available, or manual scaling.
            // For SlimSAM / transformers.js, we often re-run processor or construct inputs manually.

            // Simplified approach for transformers.js v2/v3:
            // Use the `points` argument in process if we were running full pipeline.
            // But we want to reuse embeddings.

            // Construct inputs object for model
            const input_points = points ? new Tensor('float32', points.flat(), [1, points.length, 2]) : null;
            const input_labels = labels ? new Tensor('float32', labels, [1, labels.length]) : null;

            // We need to scale points to the model input size (usually 1024x1024)
            // SlimSAM might be different.
            // Let's rely on the processor if possible, or manual scaling.

            // Manual scaling:
            // (x * 1024 / origW)
            // Check model config for size? SlimSAM is variable but trained at 1024 often.
            // Let's assume standard behavior for now:
            // Re-scale points?
            // Let's try passing points directly to model if the library handles it, 
            // otherwise we might need to manually preprocess points.

            // Actually transformers.js SAM support for `get_image_embeddings` implies we feed those back.
            // `model({ ...image_embeddings, input_points, input_labels })`

            // But we DO need to scale points.
            // The processor usually creates `reshape_input` but we can calculate scale.

            const scaleX = embeddingData.input_width / embeddingData.orig_width;
            const scaleY = embeddingData.input_height / embeddingData.orig_height;

            const scaledPoints = points?.map(p => [(p as any)[0] * scaleX, (p as any)[1] * scaleY]);

            const samInputs = {
                ...embeddingData.image_embeddings, // image_embeddings tensor
                input_points: scaledPoints ? new Tensor('float32', scaledPoints.flat(), [1, scaledPoints.length, 2]) : undefined,
                input_labels: labels ? new Tensor('float32', labels, [1, labels.length]) : undefined,
            }

            const outputs = await model(samInputs);

            // Outputs contains `pred_masks` and `iou_predictions`
            // We usually take the mask with highest IoU score.
            // Or simpler: best mask is usually index 0 in single-mask mode?
            // Transformers.js usually returns 3 masks (low, med, high res/ambiguity).

            // Flatten mask to bitmap
            const masks = outputs.pred_masks; // [1, 3, 256, 256] typically (low res masks)
            // Need to upsample?
            // SAM includes post-processing usually.

            // Actually, transformers.js might output low-res masks (256x256).
            // We need to resize them to original image size.

            // Let's extract the best mask (highest IoU)
            const iou_scores = outputs.iou_predictions.data;
            const bestIndex = iou_scores.indexOf(Math.max(...iou_scores));

            // Get mask data for best index
            // Shape: [batch, num_masks, height, width]
            // We want batch 0, mask bestIndex.

            const maskData = masks; // Tensor
            const maskH = maskData.dims[2];
            const maskW = maskData.dims[3];
            const maskStride = maskH * maskW;
            const maskOffset = bestIndex * maskStride;

            // Create OffscreenCanvas for mask
            const maskCanvas = new OffscreenCanvas(embeddingData.orig_width, embeddingData.orig_height);
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) throw new Error("No ctx");

            // The mask output is logits (scores). We need to threshold them (usually > 0.0).
            // Also it is 256x256 (typically). process it on small canvas then draw scaled up.

            const lowResCanvas = new OffscreenCanvas(maskW, maskH);
            const lowResCtx = lowResCanvas.getContext('2d');
            if (!lowResCtx) throw new Error("No lowResCtx");
            const imgData = lowResCtx.createImageData(maskW, maskH);

            // Create raw mask for extraction (Opaque=Remove, Transparent=Keep)
            const rawMaskCanvas = new OffscreenCanvas(maskW, maskH);
            const rawMaskCtx = rawMaskCanvas.getContext('2d');
            if (!rawMaskCtx) throw new Error("No rawMaskCtx");
            const rawImgData = rawMaskCtx.createImageData(maskW, maskH);

            for (let i = 0; i < maskStride; i++) {
                const val = maskData.data[maskOffset + i];
                // PowerPoint style:
                // Val > 0.0 is the "Object" (Keep). We want this to be TRANSPARENT.
                // Val <= 0.0 is the "Background" (Remove). We want this to be PURPLE overlay.

                const isObject = val > 0.0;

                // Display Mask (Purple Overlay)
                // Val > 0.0 is the "Object" (Keep). We want this to be TRANSPARENT.
                // Val <= 0.0 is the "Background" (Remove). We want this to be PURPLE overlay.
                if (isObject) {
                    imgData.data[i * 4 + 3] = 0; // Transparent
                } else {
                    // Purple overlay (rgba(168, 85, 247, 0.5) -> tailwind purple-500 approx)
                    imgData.data[i * 4 + 0] = 168; // R
                    imgData.data[i * 4 + 1] = 85;  // G
                    imgData.data[i * 4 + 2] = 247; // B
                    imgData.data[i * 4 + 3] = 120; // Alpha (semi-transparent)
                }

                // Raw Mask for Extraction (Destination-Out)
                // We want to remove the Background.
                // Destination-out removes where the mask is OPAQUE.
                // So Background should be OPAQUE. Object should be TRANSPARENT.
                if (isObject) {
                    rawImgData.data[i * 4 + 3] = 0; // Transparent (Keep)
                } else {
                    rawImgData.data[i * 4 + 0] = 0;
                    rawImgData.data[i * 4 + 1] = 0;
                    rawImgData.data[i * 4 + 2] = 0;
                    rawImgData.data[i * 4 + 3] = 255; // Opaque Black (Remove)
                }
            }
            lowResCtx.putImageData(imgData, 0, 0);
            rawMaskCtx.putImageData(rawImgData, 0, 0);

            // Scale up display mask
            maskCtx.clearRect(0, 0, embeddingData.orig_width, embeddingData.orig_height);
            maskCtx.drawImage(lowResCanvas, 0, 0, embeddingData.orig_width, embeddingData.orig_height);
            const blob = await maskCanvas.convertToBlob();

            // Scale up raw mask
            maskCtx.clearRect(0, 0, embeddingData.orig_width, embeddingData.orig_height);
            maskCtx.drawImage(rawMaskCanvas, 0, 0, embeddingData.orig_width, embeddingData.orig_height);
            const rawBlob = await maskCanvas.convertToBlob();

            self.postMessage({ status: 'decoded', uuid, mask: blob, rawMask: rawBlob });
        }

    } catch (err: any) {
        console.error(err);
        self.postMessage({ status: 'error', error: err.message, id });
    }
};

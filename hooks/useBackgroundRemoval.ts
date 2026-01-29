import { useState, useEffect, useRef, useCallback } from 'react';

export type ProcessStatus = 'queued' | 'processing' | 'done' | 'error';

export interface ImageItem {
    id: string;
    file: File;
    status: ProcessStatus;
    result?: Blob;
    error?: string;
    originalUrl: string;
    resultUrl?: string; // ObjectURL for display
}

export function useBackgroundRemoval() {
    const workerRef = useRef<Worker | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [items, setItems] = useState<ImageItem[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Initialize Worker
    useEffect(() => {
        if (!workerRef.current) {
            workerRef.current = new Worker(new URL('../workers/segmentation.worker.ts', import.meta.url), {
                type: 'module',
            });

            workerRef.current.onmessage = (e) => {
                const { status, id, result, error, message } = e.data;

                if (status === 'ready') {
                    setIsReady(true);
                    console.log("Worker ready:", message);
                } else if (status === 'error' && !id) {
                    // Global/Init Error
                    setInitError(error || "Model initialization failed");
                    console.error("Worker Initialization Error:", error);
                } else if (status === 'complete') {
                    handleComplete(id, result);
                } else if (status === 'error') {
                    handleError(id, error);
                }
            };

            // Preload model
            workerRef.current.postMessage({ command: 'preload' });
        }

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // Queue Processor
    useEffect(() => {
        if (isReady && isPlaying && processingId === null) {
            const nextItem = items.find(i => i.status === 'queued');
            if (nextItem) {
                processItem(nextItem);
            } else {
                setIsPlaying(false);
            }
        }
    }, [isReady, isPlaying, processingId, items]);

    const processItem = (item: ImageItem) => {
        setProcessingId(item.id);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));

        // Read file as ArrayBuffer or DataURL to transfer to Worker
        // Blob cannot be passed directly to some Worker setups without structured clone, but standard Workers support Blobs.
        // We'll pass the file directly (It is a Blob).
        workerRef.current?.postMessage({
            id: item.id,
            image: item.file,
        });
    };

    const handleComplete = (id: string, resultBlob: Blob) => {
        const url = URL.createObjectURL(resultBlob);
        setItems(prev => prev.map(i => i.id === id ? {
            ...i,
            status: 'done',
            result: resultBlob,
            resultUrl: url
        } : i));
        setProcessingId(null);
    };

    const handleError = (id: string, errorMsg: string) => {
        console.error("Error processing", id, errorMsg);
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: errorMsg } : i));
        setProcessingId(null);
    };

    const addFiles = useCallback((files: File[], initialStatus: ProcessStatus = 'queued') => {
        const newItems: ImageItem[] = files.map(f => ({
            id: Math.random().toString(36).substring(7),
            file: f,
            status: initialStatus,
            originalUrl: URL.createObjectURL(f),
            // If it's already done (e.g. Smart Select), the original IS the result.
            // But usually 'result' is separate. 
            // For Smart Select, we pass the blob as 'file'. 
            // We should probably set resultUrl = originalUrl if status is done?
            // Let's keep it simple: if done, user sees 'originalUrl' in list, but we might want to set result too?
            // Actually, ImageList displays 'resultUrl' if available, else 'originalUrl' with overlay?
            // No, ImageList shows 'original' on left, 'result' on right.
            // If Smart Select adds a file, it's treated as "Input".
            // Ideally, Smart Select output should be the "Result" of a new item?
            // Or the "Input" of a new item that is already "Done"?
            // If it's "Done", it needs a result blob.
            result: initialStatus === 'done' ? f : undefined,
            resultUrl: initialStatus === 'done' ? URL.createObjectURL(f) : undefined
        }));

        setItems(prev => [...prev, ...newItems]);
    }, []);

    const addBlob = useCallback((blob: Blob, initialStatus: ProcessStatus = 'queued') => {
        const file = new File([blob], `cropped-${Date.now()}.png`, { type: 'image/png' });
        addFiles([file], initialStatus);
    }, [addFiles]);

    const removeItem = useCallback((id: string) => {
        setItems(prev => {
            const next = prev.filter(i => i.id !== id);
            // Cleanup URLs
            const item = prev.find(i => i.id === id);
            if (item) {
                URL.revokeObjectURL(item.originalUrl);
                if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
            }
            return next;
        });
    }, []);

    const updateResult = useCallback((id: string, newBlob: Blob) => {
        setItems(prev => prev.map(i => {
            if (i.id === id) {
                // Revoke old result URL
                if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
                return {
                    ...i,
                    status: 'done',
                    result: newBlob,
                    resultUrl: URL.createObjectURL(newBlob)
                };
            }
            return i;
        }));
    }, []);

    const startProcessing = useCallback(() => {
        setIsPlaying(true);
    }, []);

    const resetAll = useCallback(() => {
        setItems(prev => {
            prev.forEach(item => {
                URL.revokeObjectURL(item.originalUrl);
                if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
            });
            return [];
        });
        setIsPlaying(false);
        setProcessingId(null);
    }, []);

    return {
        isReady,
        initError,
        items,
        addFiles,
        addBlob,
        removeItem,
        updateResult,
        isPlaying,
        startProcessing,
        resetAll
    };
}

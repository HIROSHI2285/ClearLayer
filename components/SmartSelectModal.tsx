"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Check, X, Wand2, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartSelectModalProps {
    isOpen: boolean;
    imageUrl: string;
    onClose: () => void;
    onSave: (blob: Blob) => void;
}

interface Point {
    x: number;
    y: number;
    label: number; // 1 = positive (keep), 0 = negative (remove)
}

export function SmartSelectModal({ isOpen, imageUrl, onClose, onSave }: SmartSelectModalProps) {
    const workerRef = useRef<Worker | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [maskUrl, setMaskUrl] = useState<string | null>(null);
    const [rawMaskUrl, setRawMaskUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uuid] = useState(() => Math.random().toString(36).substring(7));
    const [mode, setMode] = useState<'positive' | 'negative'>('positive');

    // Initialize Worker
    useEffect(() => {
        if (!isOpen) return;

        workerRef.current = new Worker(new URL('../workers/samWorker.ts', import.meta.url), {
            type: 'module',
        });

        workerRef.current.onmessage = (e) => {
            const { status, message, error, mask, rawMask } = e.data;

            if (status === 'ready') {
                setIsModelLoading(false);
                startEmbedding();
            } else if (status === 'encoded') {
                setIsEmbedding(false);
            } else if (status === 'decoded') {
                // mask is a Blob
                if (maskUrl) URL.revokeObjectURL(maskUrl);
                if (rawMaskUrl) URL.revokeObjectURL(rawMaskUrl);
                setMaskUrl(URL.createObjectURL(mask));
                setRawMaskUrl(URL.createObjectURL(rawMask));
            } else if (status === 'error') {
                setError(error || 'Unknown error');
                setIsEmbedding(false);
            }
        };

        // Preload
        workerRef.current.postMessage({ command: 'preload' });

        return () => {
            workerRef.current?.terminate();
            if (maskUrl) URL.revokeObjectURL(maskUrl);
            if (rawMaskUrl) URL.revokeObjectURL(rawMaskUrl);
        };
    }, [isOpen]);

    const startEmbedding = async () => {
        setIsEmbedding(true);
        // Fetch image as blob to send to worker
        try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            workerRef.current?.postMessage({
                command: 'encode',
                uuid,
                image: blob
            });
        } catch (e) {
            setError("Failed to load image for embedding");
            setIsEmbedding(false);
        }
    };

    const handlePointClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isEmbedding || isModelLoading || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Scale to natural image size for the worker (handled in worker via width/height ratio, but we pass raw coords usually?)
        // Wait, SAM worker expects coords relative to the image passed to encode.
        // We displayed the image with `object-contain`. We need to map click to image coordinates.

        const img = containerRef.current.querySelector('img');
        if (!img) return;

        // Calculate image position within container (due to object-contain)
        const ratio = img.naturalWidth / img.naturalHeight;
        const containerRatio = rect.width / rect.height;

        let displayWidth, displayHeight, offsetX, offsetY;

        if (containerRatio > ratio) {
            // Container is wider than image: Image is height-constrained
            displayHeight = rect.height;
            displayWidth = displayHeight * ratio;
            offsetX = (rect.width - displayWidth) / 2;
            offsetY = 0;
        } else {
            // Container is taller: Image is width-constrained
            displayWidth = rect.width;
            displayHeight = displayWidth / ratio;
            offsetX = 0;
            offsetY = (rect.height - displayHeight) / 2;
        }

        // Check if click is inside image
        if (x < offsetX || x > offsetX + displayWidth || y < offsetY || y > offsetY + displayHeight) {
            return; // Clicked on background, ignore
        }

        // Map to natural dimensions
        const naturalX = (x - offsetX) * (img.naturalWidth / displayWidth);
        const naturalY = (y - offsetY) * (img.naturalHeight / displayHeight);

        const newPoint = { x: naturalX, y: naturalY, label: mode === 'positive' ? 1 : 0 };
        const newPoints = [...points, newPoint];
        setPoints(newPoints);

        // Send to worker
        workerRef.current?.postMessage({
            command: 'decode',
            uuid,
            points: newPoints.map(p => [p.x, p.y]),
            labels: newPoints.map(p => p.label)
        });
    };

    const handleSave = async () => {
        if (!maskUrl) return;

        // We need to composite the original image with the mask
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        await new Promise(r => img.onload = r);

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);

        // Mask composite using rawMask (Opaque=Remove)
        if (!rawMaskUrl) return;

        const maskImg = new Image();
        maskImg.src = rawMaskUrl;
        await new Promise(r => maskImg.onload = r);

        // Destination-out to remove opaque areas (Background)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) onSave(blob);
            onClose();
        }, 'image/png');
    };

    // Convert point coordinates back to display coordinates for rendering dots
    const getDisplayCoords = (p: Point) => {
        if (!containerRef.current) return { left: 0, top: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const img = containerRef.current.querySelector('img');
        if (!img) return { left: 0, top: 0 };

        const ratio = img.naturalWidth / img.naturalHeight;
        const containerRatio = rect.width / rect.height;

        let displayWidth, displayHeight, offsetX, offsetY;

        if (containerRatio > ratio) {
            displayHeight = rect.height;
            displayWidth = displayHeight * ratio;
            offsetX = (rect.width - displayWidth) / 2;
            offsetY = 0;
        } else {
            displayWidth = rect.width;
            displayHeight = displayWidth / ratio;
            offsetX = 0;
            offsetY = (rect.height - displayHeight) / 2;
        }

        return {
            left: offsetX + (p.x / img.naturalWidth) * displayWidth,
            top: offsetY + (p.y / img.naturalHeight) * displayHeight
        };
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-500" />
                        AI Smart Select (Point & Click)
                    </DialogTitle>
                    <DialogDescription>
                        Click on the image to select areas to keep (Green) or remove (Red). The AI will auto-adjust the selection.
                    </DialogDescription>
                </DialogHeader>

                <div
                    className="flex-1 bg-slate-900 overflow-hidden relative group cursor-crosshair"
                    ref={containerRef}
                    onClick={handlePointClick}
                >
                    {error && (
                        <div className="absolute top-4 left-4 right-4 z-50 bg-red-500/90 text-white p-2 rounded shadow-lg text-sm flex justify-between">
                            <span>Error: {error}</span>
                            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                        </div>
                    )}
                    {/* Background Image */}
                    <img
                        src={imageUrl}
                        className="w-full h-full object-contain pointer-events-none opacity-80"
                        alt="target"
                    />

                    {/* Mask Overlay */}
                    {maskUrl && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* Worker returns a Purple overlay for background, Transparent for object */}
                            <img src={maskUrl} className="w-full h-full object-contain" alt="mask" />
                        </div>
                    )}

                    {/* Points */}
                    {points.map((p, i) => {
                        const coords = getDisplayCoords(p);
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2",
                                    p.label === 1 ? "bg-green-500" : "bg-red-500"
                                )}
                                style={{ left: coords.left, top: coords.top }}
                            />
                        );
                    })}

                    {/* Loading Overlay */}
                    {(isModelLoading || isEmbedding) && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-50">
                            <Loader2 className="w-10 h-10 animate-spin mb-2" />
                            <p>{isModelLoading ? "Loading AI Model..." : "Analyzing Image..."}</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 border-t bg-white flex justify-between items-center sm:justify-between">
                    <div className="flex gap-2 items-center">
                        <Button
                            size="sm"
                            variant={mode === 'positive' ? 'default' : 'outline'}
                            onClick={() => setMode('positive')}
                            className={cn(mode === 'positive' ? "bg-green-600 hover:bg-green-700" : "text-green-600 border-green-200")}
                        >
                            <Check className="w-4 h-4 mr-1" /> Keep Area
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'negative' ? 'default' : 'outline'}
                            onClick={() => setMode('negative')}
                            className={cn(mode === 'negative' ? "bg-red-600 hover:bg-red-700" : "text-red-600 border-red-200")}
                        >
                            <X className="w-4 h-4 mr-1" /> Remove Area
                        </Button>
                        <span className="text-xs text-slate-500 ml-2">Click on image to add points</span>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setPoints([])}>
                            Reset Points
                        </Button>
                        <Button onClick={handleSave} disabled={!maskUrl || points.length === 0}>
                            Extract Selection
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

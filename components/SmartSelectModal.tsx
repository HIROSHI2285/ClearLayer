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
    const [sensitivity, setSensitivity] = useState(0.5);
    const [smoothness, setSmoothness] = useState(0.5);
    const [maskIndex, setMaskIndex] = useState(-1); // -1 = Auto (best), 0 = SubPart, 1 = Part, 2 = Whole

    // Use refs for cleanup to avoid stale closures in onmessage
    const maskUrlRef = useRef<string | null>(null);
    const rawMaskUrlRef = useRef<string | null>(null);

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
                if (maskUrlRef.current) URL.revokeObjectURL(maskUrlRef.current);
                if (rawMaskUrlRef.current) URL.revokeObjectURL(rawMaskUrlRef.current);

                const newMaskUrl = URL.createObjectURL(mask);
                const newRawMaskUrl = URL.createObjectURL(rawMask);

                maskUrlRef.current = newMaskUrl;
                rawMaskUrlRef.current = newRawMaskUrl;

                setMaskUrl(newMaskUrl);
                setRawMaskUrl(newRawMaskUrl);
            } else if (status === 'error') {
                setError(error || 'Unknown error');
                setIsEmbedding(false);
            }
        };

        // Preload
        workerRef.current.postMessage({ command: 'preload' });

        return () => {
            workerRef.current?.terminate();
            if (maskUrlRef.current) URL.revokeObjectURL(maskUrlRef.current);
            if (rawMaskUrlRef.current) URL.revokeObjectURL(rawMaskUrlRef.current);
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

    const triggerDecode = useCallback((currentPoints: Point[], sens: number, smooth: number, mIdx: number) => {
        if (!workerRef.current || currentPoints.length === 0) return;
        workerRef.current.postMessage({
            command: 'decode',
            uuid,
            points: currentPoints.map(p => [p.x, p.y]),
            labels: currentPoints.map(p => p.label),
            sensitivity: sens,
            smoothness: smooth,
            maskIndex: mIdx
        });
    }, [uuid]);

    // Re-decode when sensitivity/smoothness/maskIndex changes
    useEffect(() => {
        if (points.length > 0) {
            const timer = setTimeout(() => triggerDecode(points, sensitivity, smoothness, maskIndex), 50);
            return () => clearTimeout(timer);
        }
    }, [sensitivity, smoothness, maskIndex, triggerDecode]);

    const handlePointClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isEmbedding || isModelLoading || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const img = containerRef.current.querySelector('img');
        if (!img) return;

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

        if (x < offsetX || x > offsetX + displayWidth || y < offsetY || y > offsetY + displayHeight) {
            return;
        }

        const naturalX = (x - offsetX) * (img.naturalWidth / displayWidth);
        const naturalY = (y - offsetY) * (img.naturalHeight / displayHeight);

        const newPoint = { x: naturalX, y: naturalY, label: mode === 'positive' ? 1 : 0 };
        const newPoints = [...points, newPoint];
        setPoints(newPoints);

        triggerDecode(newPoints, sensitivity, smoothness, maskIndex);
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
            <DialogContent className="sm:max-w-[1000px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden glass border-white/10 shadow-2xl rounded-[2rem]">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-500" />
                        AIスマート選択 (クリックして指定)
                    </DialogTitle>
                    <DialogDescription className="flex flex-col gap-1">
                        <span>画像をクリックして、残したい領域（緑）や消したい領域（赤）を指定してください。AIが自動で境界線を調整します。</span>
                        <span className="text-amber-600 font-medium font-bold text-xs">ヒント: 輪郭ではなく、対象物の「内側」をクリックするとうまくいきます。</span>
                    </DialogDescription>
                </DialogHeader>

                <div
                    className="flex-1 bg-slate-900 overflow-hidden relative group cursor-crosshair"
                    ref={containerRef}
                    onClick={handlePointClick}
                >
                    {error && (
                        <div className="absolute top-4 left-4 right-4 z-50 bg-red-500/90 text-white p-2 rounded shadow-lg text-sm flex justify-between">
                            <span>エラー: {error}</span>
                            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                        </div>
                    )}
                    {/* Background Image */}
                    <img
                        src={imageUrl}
                        className="w-full h-full object-contain pointer-events-none"
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
                            <p>{isModelLoading ? "AIモデルを準備中..." : "画像を解析中..."}</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 border-t bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col gap-3 w-full sm:w-auto">
                        <div className="flex gap-2 items-center">
                            <Button
                                size="sm"
                                variant={mode === 'positive' ? 'default' : 'outline'}
                                onClick={() => setMode('positive')}
                                className={cn(mode === 'positive' ? "bg-green-600 hover:bg-green-700" : "text-green-600 border-green-200")}
                            >
                                <Check className="w-4 h-4 mr-1" /> 残すエリア (緑)
                            </Button>
                            <Button
                                size="sm"
                                variant={mode === 'negative' ? 'default' : 'outline'}
                                onClick={() => setMode('negative')}
                                className={cn(mode === 'negative' ? "bg-red-600 hover:bg-red-700" : "text-red-600 border-red-200")}
                            >
                                <X className="w-4 h-4 mr-1" /> 消すエリア (赤)
                            </Button>
                        </div>

                        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-md border border-slate-100">
                            <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">感度 (Sensitivity)</label>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="0.95"
                                    step="0.01"
                                    value={sensitivity}
                                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400">
                                    <span>狭く</span>
                                    <span>広く</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">滑らかさ (Smoothness)</label>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="0.95"
                                    step="0.01"
                                    value={smoothness}
                                    onChange={(e) => setSmoothness(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400">
                                    <span>シャープ</span>
                                    <span>ソフト</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">マスク範囲</label>
                                <div className="flex border rounded overflow-hidden">
                                    <button
                                        onClick={() => setMaskIndex(-1)}
                                        className={cn("px-2 py-1 text-[10px] font-medium transition-colors", maskIndex === -1 ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}
                                    >自動</button>
                                    <button
                                        onClick={() => setMaskIndex(0)}
                                        className={cn("px-2 py-1 text-[10px] font-medium transition-colors border-l", maskIndex === 0 ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}
                                    >一部分</button>
                                    <button
                                        onClick={() => setMaskIndex(1)}
                                        className={cn("px-2 py-1 text-[10px] font-medium transition-colors border-l", maskIndex === 1 ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}
                                    >物体</button>
                                    <button
                                        onClick={() => setMaskIndex(2)}
                                        className={cn("px-2 py-1 text-[10px] font-medium transition-colors border-l", maskIndex === 2 ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100")}
                                    >全体</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setPoints([])}>
                            リセット
                        </Button>
                        <Button onClick={handleSave} disabled={!maskUrl || points.length === 0}>
                            選択範囲を保存
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

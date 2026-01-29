"use client";

import { useState, useRef, useEffect, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Eraser, Loader2, Save, Undo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EraserModalProps {
    isOpen: boolean;
    imageUrl: string;
    onClose: () => void;
    onSave: (editedBlob: Blob) => void;
}

export function EraserModal({ isOpen, imageUrl, onClose, onSave }: EraserModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [brushSize, setBrushSize] = useState(20);
    const [isDrawing, setIsDrawing] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    // History for Undo (Simple implementation: save snapshot on mouse down)
    const [history, setHistory] = useState<ImageData[]>([]);

    useEffect(() => {
        let isMounted = true;
        if (!isOpen || !canvasRef.current || !imageUrl) return;

        setImageLoaded(false);
        console.log("EraserModal: Opening with image", imageUrl.substring(0, 50) + "...");

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            if (!isMounted) return;
            console.log("EraserModal: Image loaded successfully", img.width, "x", img.height);
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            setImageLoaded(true);
        };
        img.onerror = (e) => {
            if (!isMounted) return;
            console.error("EraserModal: Failed to load image", imageUrl, e);
            setImageLoaded(true);
        };

        img.src = imageUrl;
        return () => { isMounted = false; };
    }, [isOpen, imageUrl]);

    const getMousePos = (e: MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: MouseEvent) => {
        setIsDrawing(true);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
            // Save state for undo
            setHistory(prev => [...prev.slice(-4), ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)]);

            const { x, y } = getMousePos(e);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const draw = (e: MouseEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            const { x, y } = getMousePos(e);
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleUndo = () => {
        if (history.length === 0 || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            const lastState = history[history.length - 1];
            ctx.putImageData(lastState, 0, 0);
            setHistory(prev => prev.slice(0, -1));
        }
    };

    const handleSave = () => {
        if (!canvasRef.current) return;
        setIsProcessing(true);
        canvasRef.current.toBlob((blob) => {
            if (blob) {
                onSave(blob);
                onClose();
            }
            setIsProcessing(false);
        }, 'image/png');
    };

    // Checkerboard background style
    const transparencyStyle = {
        backgroundImage: `
            linear-gradient(45deg, #334155 25%, transparent 25%), 
            linear-gradient(-45deg, #334155 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #334155 75%), 
            linear-gradient(-45deg, transparent 75%, #334155 75%)
        `,
        backgroundSize: '20px 20px',
        backgroundColor: '#0f172a' // Dark background for contrast
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b text-slate-900 bg-white">
                    <DialogTitle className="flex items-center gap-2">
                        <Eraser className="w-5 h-5" />
                        消しゴムツール
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        ブラシを使って画像の一部を消去したり、修正したりできます。
                    </DialogDescription>
                </DialogHeader>

                {/* Canvas Area */}
                <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center relative touch-none" style={transparencyStyle}>
                    {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-10">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    )}
                    <canvas
                        ref={canvasRef}
                        className={cn(
                            "max-w-full max-h-full cursor-crosshair shadow-2xl transition-opacity",
                            imageLoaded ? "opacity-100" : "opacity-0"
                        )}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                    />
                </div>

                {/* Toolbar */}
                <DialogFooter className="p-4 border-t bg-white flex-col sm:flex-row gap-4 items-center">
                    <div className="flex items-center gap-4 flex-1 w-full">
                        <div className="w-4 h-4 rounded-full border border-slate-300 bg-black flex-shrink-0" style={{ width: brushSize, height: brushSize, maxWidth: 32, maxHeight: 32 }} />
                        <Slider
                            value={[brushSize]}
                            onValueChange={(val) => setBrushSize(val[0])}
                            min={5}
                            max={100}
                            step={5}
                            className="flex-1 max-w-[200px]"
                        />
                        <span className="text-sm text-slate-500 w-12">{brushSize}px</span>

                        <Button variant="ghost" size="icon" onClick={handleUndo} disabled={history.length === 0} title="Undo">
                            <Undo className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isProcessing}>
                            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Apply Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

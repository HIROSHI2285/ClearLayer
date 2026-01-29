"use client";

import { useState, useRef, useEffect, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [brushSize, setBrushSize] = useState(20);
    const [isDrawing, setIsDrawing] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Zoom and Pan state
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

    // History for Undo
    const [history, setHistory] = useState<ImageData[]>([]);

    useEffect(() => {
        if (isOpen) {
            setImageLoaded(false);
            setHistory([]);
            setScale(1);
            setOffset({ x: 0, y: 0 });
        }
    }, [isOpen]);

    const getMousePos = (e: MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();

        // Calculate position relative to the canvas element's current on-screen size
        const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        return { x, y };
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = Math.pow(1.1, delta / 100);
            setScale(prev => Math.min(Math.max(prev * factor, 0.1), 10));
        } else if (!isDrawing) {
            // Standard scroll moves the offset if not drawing
            setOffset(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    const startDrawing = (e: MouseEvent) => {
        // Space key panning handled via global events or middle click
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            setLastPosition({ x: e.clientX, y: e.clientY });
            return;
        }

        setIsDrawing(true);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
            setHistory(prev => [...prev.slice(-9), ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)]);
            const { x, y } = getMousePos(e);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - lastPosition.x;
            const dy = e.clientY - lastPosition.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastPosition({ x: e.clientX, y: e.clientY });
            return;
        }

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
        setIsPanning(false);
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

    // Checkerboard background style (moves with the image)
    const transparencyStyle = {
        backgroundImage: `
            linear-gradient(45deg, #334155 25%, transparent 25%), 
            linear-gradient(-45deg, #334155 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #334155 75%), 
            linear-gradient(-45deg, transparent 75%, #334155 75%)
        `,
        backgroundSize: '20px 20px',
        backgroundColor: '#0f172a'
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[90vw] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-950 border-white/10 shadow-2xl rounded-3xl">
                <DialogHeader className="p-4 border-b border-white/5 text-white bg-slate-900/50 backdrop-blur-md">
                    <DialogTitle className="flex items-center gap-2">
                        <Eraser className="w-5 h-5 text-primary" />
                        消しゴムツール
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        マウスホイールでズーム、ドラッグで消去、Ctrl+マウスホイールで拡大縮小できます。
                    </DialogDescription>
                </DialogHeader>

                {/* Canvas Area */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-black overflow-hidden flex items-center justify-center relative touch-none cursor-default"
                    onWheel={handleWheel}
                >
                    <div
                        className="relative transition-transform duration-75 ease-out select-none shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            cursor: isPanning ? 'grabbing' : 'auto'
                        }}
                    >
                        <div className="relative rounded-sm overflow-hidden" style={transparencyStyle}>
                            <img
                                src={imageUrl}
                                alt="Background"
                                className="max-w-[80vw] max-h-[70vh] object-contain block opacity-0 pointer-events-none"
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    const canvas = canvasRef.current;
                                    if (canvas) {
                                        canvas.width = img.naturalWidth;
                                        canvas.height = img.naturalHeight;
                                        const ctx = canvas.getContext('2d');
                                        if (ctx) {
                                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                                            ctx.drawImage(img, 0, 0);
                                            setImageLoaded(true);
                                        }
                                    }
                                }}
                            />
                            <canvas
                                ref={canvasRef}
                                className={cn(
                                    "absolute inset-0 w-full h-full cursor-crosshair transition-opacity duration-300",
                                    imageLoaded ? "opacity-100" : "opacity-0"
                                )}
                                onMouseDown={startDrawing}
                                onMouseMove={handleMouseMove}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onContextMenu={(e) => e.preventDefault()}
                            />
                        </div>

                        {!imageLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm z-10">
                                <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Zoom HUD */}
                    <div className="absolute bottom-6 right-6 flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-2 px-4 rounded-2xl text-white/70 text-xs font-bold shadow-2xl">
                        <span>{Math.round(scale * 100)}%</span>
                        <div className="w-px h-3 bg-white/10" />
                        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="hover:text-primary transition-colors uppercase tracking-widest text-[10px]">Reset</button>
                    </div>

                    {/* Controls Guide */}
                    <div className="absolute bottom-6 left-6 hidden md:flex items-center gap-4 text-white/30 text-[10px] uppercase font-bold tracking-widest bg-black/20 p-2 px-4 rounded-xl">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[8px]">Ctrl</span>
                            <span>+ Wheel Zoom</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[8px]">Mid</span>
                            <span>Drag to Pan</span>
                        </div>
                    </div>
                </div>

                {/* Toolbar */}
                <DialogFooter className="p-4 border-t border-white/5 bg-slate-900 flex-col sm:flex-row gap-6 items-center shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center gap-6 flex-1 w-full">
                        <div className="flex flex-col gap-1.5 min-w-[32px]">
                            <div className="w-8 h-8 rounded-full border-2 border-primary/30 bg-white/5 flex items-center justify-center overflow-hidden">
                                <div className="rounded-full bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" style={{ width: Math.max(2, brushSize * 0.3), height: Math.max(2, brushSize * 0.3) }} />
                            </div>
                        </div>

                        <div className="flex-1 max-w-[300px] flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <span>ブラシサイズ</span>
                                <span className="text-primary">{brushSize}px</span>
                            </div>
                            <Slider
                                value={[brushSize]}
                                onValueChange={(val) => setBrushSize(val[0])}
                                min={1}
                                max={200}
                                step={1}
                                className="w-full"
                            />
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all disabled:opacity-20"
                            title="元に戻す"
                        >
                            <Undo className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="ghost" onClick={onClose} disabled={isProcessing} className="flex-1 sm:flex-none text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl px-6">
                            キャンセル
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white rounded-2xl px-8 font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "変更を保存"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

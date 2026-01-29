"use client";

import { ImageItem } from '@/hooks/useBackgroundRemoval';
import { Loader2, Download, XCircle, CheckCircle2, Scissors, Eraser, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';

interface PreviewCardProps {
    item: ImageItem;
    onRemove?: (id: string) => void;
    onCrop?: (item: ImageItem) => void;
    onEraser?: (item: ImageItem) => void;
    onSmartSelect?: (item: ImageItem) => void;
}

export function PreviewCard({ item, onRemove, onCrop, onEraser, onSmartSelect }: PreviewCardProps) {
    // Checkerboard pattern for transparency
    const transparencyStyle = {
        backgroundImage: `
            linear-gradient(45deg, #e5e7eb 25%, transparent 25%), 
            linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #e5e7eb 75%), 
            linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
        `,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
    };

    return (
        <Card className="overflow-hidden group relative">
            <div className="relative aspect-square w-full bg-white transition-all">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-50" style={transparencyStyle}></div>

                {/* Image Display */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <img
                        src={item.resultUrl || item.originalUrl}
                        alt="preview"
                        className="max-w-full max-h-full object-contain drop-shadow-sm"
                    />
                </div>

                {/* Overlays */}
                {item.status === 'processing' && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                )}

                {item.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                        <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                )}

                {/* Delete Button */}
                {onRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/70 hover:bg-red-100 hover:text-red-500 transition-colors shadow-sm"
                        onClick={() => onRemove(item.id)}
                    >
                        <X className="w-3 h-3" />
                    </Button>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-white border-t flex items-center justify-between gap-2">
                <div className="text-xs truncate text-slate-500 flex-1" title={item.file.name}>
                    {item.file.name}
                </div>

                {item.status === 'done' ? (
                    <div className="flex gap-1 items-center">
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0 border-green-200 hover:bg-green-50 hover:text-green-600" asChild>
                            <a href={item.resultUrl} download={`bg-removed-${item.file.name}`}>
                                <Download className="w-4 h-4" />
                            </a>
                        </Button>
                    </div>
                ) : (
                    <div className="h-8 w-8 flex items-center justify-center">
                        {item.status === 'queued' && (
                            <div className="flex gap-1">
                                {onCrop && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-900" onClick={() => onCrop(item)} title="Crop / Extract Area">
                                        <Scissors className="w-4 h-4" />
                                    </Button>
                                )}
                                {onSmartSelect && (
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-400 hover:text-indigo-900" onClick={() => onSmartSelect(item)} title="Smart Select (AI)">
                                        <Wand2 className="w-4 h-4" />
                                    </Button>
                                )}
                                <span className="w-8 h-8 flex items-center justify-center">
                                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}

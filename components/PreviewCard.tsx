"use client";

import { ImageItem } from '@/hooks/useBackgroundRemoval';
import { Loader2, Download, XCircle, CheckCircle2, Scissors, Eraser, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
        <Card className="overflow-hidden group relative glass border-slate-200/60 rounded-[2.5rem] transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/10 shadow-xl shadow-purple-500/5 bg-white/60 backdrop-blur-xl">
            <div className="relative aspect-square w-full bg-slate-50/50 transition-all overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-30" style={transparencyStyle}></div>

                {/* Image Display */}
                <div className="absolute inset-0 flex items-center justify-center p-6 group-hover:scale-105 transition-transform duration-700 ease-out">
                    <img
                        src={item.resultUrl || item.originalUrl}
                        alt="preview"
                        className="max-w-full max-h-full object-contain drop-shadow-xl"
                    />
                </div>

                {/* Overlays */}
                {item.status === 'processing' && (
                    <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-md transition-all">
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full" />
                            <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                        </div>
                        <span className="mt-4 text-[10px] font-bold text-slate-500 tracking-widest uppercase">処理中...</span>
                    </div>
                )}

                {item.status === 'error' && (
                    <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center backdrop-blur-sm border border-red-200">
                        <XCircle className="w-12 h-12 text-red-400" />
                    </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-3 left-3 flex gap-2">
                    {item.status === 'done' && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 backdrop-blur-md rounded-lg py-0.5 px-2 text-[10px] font-bold">
                            完了
                        </Badge>
                    )}
                    {item.status === 'queued' && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 backdrop-blur-md rounded-lg py-0.5 px-2 text-[10px] font-bold">
                            待機中
                        </Badge>
                    )}
                </div>

                {/* Delete Button (Visible on hover) */}
                {onRemove && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/5"
                        onClick={() => onRemove(item.id)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Footer */}
            {/* Footer - 2 Line Layout for better spacing */}
            <div className="p-4 bg-white/5 border-t border-white/5 flex flex-col gap-3">
                {/* Line 1: Filename */}
                <div className="text-[11px] truncate text-muted-foreground font-medium w-full" title={item.file.name}>
                    {item.file.name}
                </div>

                {/* Line 2: Actions Row (Grid Layout for consistent 2-column alignment) */}
                <div className="grid grid-cols-2 gap-2 w-full">
                    {item.status === 'queued' && (
                        <>
                            {onCrop && (
                                <Button size="sm" variant="ghost" className="w-full h-9 px-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-100/50 transition-colors text-xs gap-2 font-medium" onClick={() => onCrop(item)} title="矩形で切り抜き">
                                    <Scissors className="w-4 h-4" />
                                    <span>矩形で切り抜き</span>
                                </Button>
                            )}
                            {onSmartSelect && (
                                <Button size="sm" variant="ghost" className="w-full h-9 px-2 rounded-xl text-purple-600/80 hover:text-purple-600 hover:bg-purple-50 transition-colors text-xs gap-2 font-medium" onClick={() => onSmartSelect(item)} title="AI切り抜き（自由形状）">
                                    <Wand2 className="w-4 h-4" />
                                    <span>AI切り抜き</span>
                                </Button>
                            )}
                            {onEraser && (
                                <Button size="sm" variant="ghost" className="w-full h-9 px-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/50 transition-colors text-xs gap-2 font-medium" onClick={() => onEraser(item)} title="消しゴム">
                                    <Eraser className="w-4 h-4" />
                                    <span>消しゴム</span>
                                </Button>
                            )}
                            {/* Save Button for Queued Items */}
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-9 px-3 rounded-xl bg-white/5 border-slate-200 text-muted-foreground hover:bg-slate-50 hover:text-slate-900 transition-colors text-xs gap-2 font-medium"
                                asChild
                            >
                                <a
                                    href={item.originalUrl}
                                    download={item.file.name}
                                    title="元の画像を保存"
                                    className="flex items-center justify-center w-full"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>保存</span>
                                </a>
                            </Button>
                        </>
                    )}

                    {/* For Done items: Alignment Fix */}
                    {item.status === 'done' && (
                        <>
                            {onEraser && (
                                <Button size="sm" variant="outline" className="w-full h-10 px-3 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-xs gap-2 font-medium" onClick={() => onEraser(item)} title="手動消しゴム">
                                    <Eraser className="w-4 h-4" />
                                    <span className="inline">修正</span>
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                    "w-full h-10 px-4 rounded-xl shadow-none transition-all",
                                    "bg-primary text-primary-foreground border-transparent hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/20"
                                )}
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = item.resultUrl || item.originalUrl;
                                    link.download = `bg-removed-${Date.now()}-${item.file.name}`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                title="結果を保存"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                <span className="text-sm font-bold tracking-wider">保存</span>
                            </Button>
                        </>
                    )}
                </div>

            </div>
        </Card >
    );
}

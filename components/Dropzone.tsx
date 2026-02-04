"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DropzoneProps {
    onDrop: (files: File[]) => void;
    className?: string;
    isReady?: boolean;
    initError?: string | null;
}

// Maximum dimension (width or height) before warning
const MAX_DIMENSION_WARNING = 5000;

// Helper to get image dimensions from a File
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error("Failed to load image"));
        };
        img.src = URL.createObjectURL(file);
    });
}

interface LargeFileInfo {
    file: File;
    width: number;
    height: number;
}

export function Dropzone({ onDrop, className, isReady, initError }: DropzoneProps) {
    const [largeFiles, setLargeFiles] = useState<LargeFileInfo[]>([]);
    const [normalFiles, setNormalFiles] = useState<File[]>([]);
    const [showWarning, setShowWarning] = useState(false);

    const handleDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const largeOnes: LargeFileInfo[] = [];
        const normalOnes: File[] = [];

        // Check dimensions for each file
        for (const file of acceptedFiles) {
            try {
                const { width, height } = await getImageDimensions(file);
                if (width > MAX_DIMENSION_WARNING || height > MAX_DIMENSION_WARNING) {
                    largeOnes.push({ file, width, height });
                } else {
                    normalOnes.push(file);
                }
            } catch {
                // If dimension check fails, treat as normal file
                normalOnes.push(file);
            }
        }

        // If there are large files, show warning
        if (largeOnes.length > 0) {
            setLargeFiles(largeOnes);
            setNormalFiles(normalOnes);
            setShowWarning(true);
        } else {
            // No large files, proceed directly
            onDrop(normalOnes);
        }
    }, [onDrop]);

    const handleProceedWithAll = () => {
        // Add all files including large ones
        onDrop([...normalFiles, ...largeFiles.map(lf => lf.file)]);
        setShowWarning(false);
        setLargeFiles([]);
        setNormalFiles([]);
    };

    const handleSkipLarge = () => {
        // Only add normal files, skip large ones
        if (normalFiles.length > 0) {
            onDrop(normalFiles);
        }
        setShowWarning(false);
        setLargeFiles([]);
        setNormalFiles([]);
    };

    const handleCancel = () => {
        // Cancel all
        setShowWarning(false);
        setLargeFiles([]);
        setNormalFiles([]);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: handleDrop,
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/webp': []
        }
    });

    return (
        <>
            <div
                {...getRootProps()}
                className={cn(
                    "relative overflow-hidden border-2 border-dashed rounded-[3rem] p-4 md:p-12 transition-all duration-500 cursor-pointer flex flex-col items-center justify-center text-center gap-6",
                    isDragActive
                        ? "border-primary bg-primary/5 scale-[0.99] shadow-xl shadow-primary/10"
                        : "border-slate-300 bg-white/50 hover:border-primary/50 hover:bg-white/80 hover:shadow-xl hover:shadow-primary/5",
                    className
                )}
            >
                <input {...getInputProps()} />

                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <UploadCloud className={cn("w-10 h-10 transition-colors", isReady ? "text-primary" : "text-slate-300 animate-pulse")} />
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xl font-bold tracking-tight text-foreground">
                        {isDragActive ? "ここにドロップして追加" : "画像を選択またはドロップ"}
                    </p>
                    <p className="text-muted-foreground text-sm max-w-sm">
                        JPG, PNG, WebPに対応しています。<br />
                        ※画像データはサーバーに送信されず、安全に処理されます。
                    </p>
                </div>

                {initError ? (
                    <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="text-[10px] font-bold text-red-500 tracking-wider">Error: {initError}</span>
                    </div>
                ) : !isReady && (
                    <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-amber-500 tracking-wider">AIモデル準備中...</span>
                    </div>
                )}
            </div>

            {/* Large Image Warning Dialog */}
            <Dialog open={showWarning} onOpenChange={setShowWarning}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                            大きな画像が含まれています
                        </DialogTitle>
                        <DialogDescription className="pt-2 space-y-2">
                            <p>
                                以下の画像は{MAX_DIMENSION_WARNING}pxを超えているため、処理中にメモリ不足になる可能性があります。
                            </p>
                            <ul className="text-xs bg-slate-50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                                {largeFiles.map((lf, i) => (
                                    <li key={i} className="flex justify-between">
                                        <span className="truncate max-w-[180px]">{lf.file.name}</span>
                                        <span className="text-slate-500 font-mono">{lf.width} x {lf.height}px</span>
                                    </li>
                                ))}
                            </ul>
                            {normalFiles.length > 0 && (
                                <p className="text-xs text-slate-500">
                                    ※ 他に{normalFiles.length}件の通常サイズの画像があります。
                                </p>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                        <Button variant="ghost" onClick={handleCancel} className="text-slate-500">
                            キャンセル
                        </Button>
                        {normalFiles.length > 0 && (
                            <Button variant="outline" onClick={handleSkipLarge}>
                                大きい画像をスキップ
                            </Button>
                        )}
                        <Button onClick={handleProceedWithAll} className="bg-amber-500 hover:bg-amber-600 text-white">
                            そのまま処理する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}


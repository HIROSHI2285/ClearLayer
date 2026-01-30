"use client";

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropzoneProps {
    onDrop: (files: File[]) => void;
    className?: string;
    isReady?: boolean;
    initError?: string | null;
}

export function Dropzone({ onDrop, className, isReady, initError }: DropzoneProps) {
    const handleDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onDrop(acceptedFiles);
        }
    }, [onDrop]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: handleDrop,
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/webp': []
        }
    });

    return (
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
    );
}

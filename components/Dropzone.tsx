"use client";

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropzoneProps {
    onDrop: (files: File[]) => void;
    className?: string;
}

export function Dropzone({ onDrop, className }: DropzoneProps) {
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
                "border-2 border-dashed rounded-xl p-10 transition-colors cursor-pointer flex flex-col items-center justify-center text-center gap-4",
                isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50",
                className
            )}
        >
            <input {...getInputProps()} />
            <div className="p-4 bg-slate-100 rounded-full">
                <UploadCloud className="w-8 h-8 text-slate-500" />
            </div>
            <div>
                <p className="text-lg font-semibold text-slate-700">
                    {isDragActive ? "ドロップして追加" : "画像ファイルをドラッグ＆ドロップ"}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    またはクリックして選択 (JPG, PNG, WebP)
                </p>
            </div>
        </div>
    );
}

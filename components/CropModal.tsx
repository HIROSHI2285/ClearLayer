"use client";

import { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getCroppedImg } from '@/lib/canvasUtils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Scissors } from 'lucide-react';

interface CropModalProps {
    isOpen: boolean;
    imageUrl: string;
    onClose: () => void;
    onCropComplete: (croppedBlob: Blob) => void;
}

export function CropModal({ isOpen, imageUrl, onClose, onCropComplete }: CropModalProps) {
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        x: 25,
        y: 25,
        width: 50,
        height: 50
    });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const handleSave = async () => {
        if (!completedCrop || !imageUrl || !imgRef.current) return;
        setIsProcessing(true);
        try {
            const image = imgRef.current;
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            const pixelCrop = {
                x: completedCrop.x * scaleX,
                y: completedCrop.y * scaleY,
                width: completedCrop.width * scaleX,
                height: completedCrop.height * scaleY,
            };

            const croppedBlob = await getCroppedImg(imageUrl, pixelCrop);
            if (croppedBlob) {
                onCropComplete(croppedBlob);
                onClose();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="w-5 h-5" />
                        Select Area
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-4">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-full"
                    >
                        <img
                            src={imageUrl}
                            alt="Crop target"
                            className="max-w-full max-h-[60vh] object-contain"
                            onLoad={(e) => (imgRef.current = e.currentTarget)}
                        />
                    </ReactCrop>
                </div>

                <DialogFooter className="p-4 border-t bg-white">
                    <div className="flex gap-2 w-full justify-end">
                        <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isProcessing || !completedCrop}>
                            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Run Extraction
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

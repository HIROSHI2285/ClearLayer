"use client";

import { useBackgroundRemoval } from '@/hooks/useBackgroundRemoval';
import { Dropzone } from '@/components/Dropzone';
import { ImageList } from '@/components/ImageList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Play } from 'lucide-react';
import { useState } from 'react';
import { CropModal } from '@/components/CropModal';
import { EraserModal } from '@/components/EraserModal';
import { ImageItem } from '@/hooks/useBackgroundRemoval';

export default function Home() {
  const { isReady, items, addFiles, addBlob, removeItem, updateResult, isPlaying, startProcessing } = useBackgroundRemoval();
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [eraserTargetId, setEraserTargetId] = useState<string | null>(null);
  const [eraserImage, setEraserImage] = useState<string | null>(null);
  const [isEraserOpen, setIsEraserOpen] = useState(false);

  const handleCropClick = (item: ImageItem) => {
    setEditingImage(item.originalUrl);
    setIsModalOpen(true);
  };

  const handleCropComplete = (blob: Blob) => {
    addBlob(blob);
    setIsModalOpen(false);
    setEditingImage(null);
  };

  const handleEraserClick = (item: ImageItem) => {
    if (item.resultUrl) {
      setEraserTargetId(item.id);
      setEraserImage(item.resultUrl); // Edit the result, not original
      setIsEraserOpen(true);
    }
  };

  const handleEraserSave = (blob: Blob) => {
    if (eraserTargetId) {
      updateResult(eraserTargetId, blob);
    }
    setIsEraserOpen(false);
    setEraserTargetId(null);
    setEraserImage(null);
  };


  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center justify-center gap-2">
            <Layers className="w-8 h-8 text-primary" />
            ClearLayer
          </h1>
          <p className="text-slate-500">
            High-Precision Browser-Side Background Remover
          </p>
          <div className="flex justify-center mt-2">
            <Badge variant={isReady ? "default" : "secondary"} className="animate-in fade-in">
              {isReady ? "AI Model Ready" : "Initializing AI Model..."}
            </Badge>
          </div>
        </div>

        {/* Action Area */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <Dropzone onDrop={addFiles} />
        </div>

        {/* Results Area */}
        <div className="space-y-4">
          {items.length > 0 && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                Processed Images ({items.length})
              </h2>
              <Button
                onClick={startProcessing}
                disabled={isPlaying || !isReady || !items.some(i => i.status === 'queued')}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                {isPlaying ? "Processing..." : "Start Processing"}
              </Button>
            </div>
          )}
          <ImageList items={items} onCrop={handleCropClick} onRemove={removeItem} onEraser={handleEraserClick} />
        </div>

        {isModalOpen && editingImage && (
          <CropModal
            isOpen={isModalOpen}
            imageUrl={editingImage}
            onClose={() => setIsModalOpen(false)}
            onCropComplete={handleCropComplete}
          />
        )}

        {isEraserOpen && eraserImage && (
          <EraserModal
            isOpen={isEraserOpen}
            imageUrl={eraserImage}
            onClose={() => setIsEraserOpen(false)}
            onSave={handleEraserSave}
          />
        )}
      </div>
    </main>
  );
}

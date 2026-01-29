"use client";

import { useBackgroundRemoval } from '@/hooks/useBackgroundRemoval';
import { Dropzone } from '@/components/Dropzone';
import { ImageList } from '@/components/ImageList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Play, RefreshCw, Sparkles, Image as ImageIcon, Download, Crown } from 'lucide-react';
import { useState } from 'react';
import { CropModal } from '@/components/CropModal';
import { EraserModal } from '@/components/EraserModal';
import { SmartSelectModal } from '@/components/SmartSelectModal';
import { ImageItem } from '@/hooks/useBackgroundRemoval';

export default function Home() {
  const { isReady, initError, items, addFiles, addBlob, removeItem, updateResult, isPlaying, startProcessing, resetAll } = useBackgroundRemoval();
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [eraserTargetId, setEraserTargetId] = useState<string | null>(null);
  const [eraserImage, setEraserImage] = useState<string | null>(null);
  const [isEraserOpen, setIsEraserOpen] = useState(false);

  const [smartSelectTargetId, setSmartSelectTargetId] = useState<string | null>(null);
  const [smartSelectImage, setSmartSelectImage] = useState<string | null>(null);
  const [isSmartSelectOpen, setIsSmartSelectOpen] = useState(false);

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
      setEraserImage(item.resultUrl);
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

  const handleSmartSelectClick = (item: ImageItem) => {
    setSmartSelectTargetId(item.id);
    setSmartSelectImage(item.originalUrl);
    setIsSmartSelectOpen(true);
  };

  const handleSmartSelectSave = (blob: Blob) => {
    addBlob(blob);
    setIsSmartSelectOpen(false);
    setSmartSelectTargetId(null);
    setSmartSelectImage(null);
  };


  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center overflow-x-hidden font-sans">
      <div className="w-full max-w-6xl space-y-12">
        {/* Navigation / Header - Minimalist */}
        <header className="flex justify-between items-center py-4 px-2">
          <div className="flex items-center gap-3">
            {/* Logo Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00C4CC] to-[#7D2AE8] flex items-center justify-center shadow-lg transform -rotate-3">
              <Layers className="w-6 h-6 text-white" />
            </div>
            {/* Brand Text */}
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              ClearLayer <span className="text-slate-400 font-normal text-base ml-1">Studio</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* User requested to remove Home/Project/Pro buttons. Keeping clean. */}
            <div className="text-xs font-medium text-slate-400">v2.1 Beta</div>
          </div>
        </header>

        {/* Hero Section - Centered, Welcoming */}
        <section className="text-center space-y-8 py-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
          <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-500">
              デザインを、自由にする。
            </span>
            <br />
            <span className="text-3xl md:text-5xl text-slate-700 font-bold mt-2 block">
              AI背景削除ツール
            </span>
          </h1>
          <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            どんな画像でも、プロクオリティで切り抜き。<br />
            クリエイティブな作業をもっと楽しく、もっと自由に。
          </p>
        </section>

        {/* The "Work Surface" - Dropzone Area */}
        {/* Looking like the "Create a design" area or a canvas */}
        <section className="glass rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden transition-all duration-500 hover:shadow-[0_30px_60px_-10px_rgba(125,42,232,0.15)]">
          {/* Decorative background blurs inside the card */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#00C4CC]/10 to-[#7D2AE8]/10 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3" />

          <div className="flex flex-col md:flex-row gap-8 items-center">
            {/* Left Column: Dropzone */}
            <div className="flex-1 w-full relative z-10">
              <Dropzone
                onDrop={addFiles}
                isReady={isReady}
                initError={initError}
                className="flex-1 bg-white/40 border-white/40 shadow-xl backdrop-blur-xl h-64 md:h-auto"
              />
            </div>

            {/* Right Column: Visual Guide */}
            <div className="hidden md:flex flex-col gap-6 w-64 shrink-0">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-600">画像をアップ</div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-600">AIが自動削除</div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-500">
                  <Download className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-slate-600">すぐに保存</div>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery Section - Grid Layout */}
        {items.length > 0 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-10 fade-in duration-700">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">
                  デザイン
                </h2>
                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 rounded-full px-3">
                  {items.length}件
                </Badge>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={resetAll}
                  variant="ghost"
                  disabled={isPlaying}
                  className="rounded-full text-slate-500 hover:text-red-500 hover:bg-red-50 px-6"
                >
                  クリア
                </Button>
                <Button
                  onClick={startProcessing}
                  disabled={isPlaying || !isReady || !items.some(i => i.status === 'queued')}
                  className="rounded-full bg-[#00C4CC] hover:bg-[#00aeb5] text-white shadow-lg shadow-teal-200/50 px-8 font-bold transition-all hover:scale-105 active:scale-95"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  {isPlaying ? "魔法をかけています..." : "一括自動処理"}
                </Button>
              </div>
            </div>

            {/* Masonry-style Grid */}
            <div className="p-1">
              <ImageList
                items={items}
                onCrop={handleCropClick}
                onRemove={removeItem}
                onEraser={handleEraserClick}
                onSmartSelect={handleSmartSelectClick}
              />
            </div>
          </div>
        )}

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

      {isSmartSelectOpen && smartSelectImage && (
        <SmartSelectModal
          isOpen={isSmartSelectOpen}
          imageUrl={smartSelectImage}
          onClose={() => setIsSmartSelectOpen(false)}
          onSave={handleSmartSelectSave}
        />
      )}
    </main>
  );
}

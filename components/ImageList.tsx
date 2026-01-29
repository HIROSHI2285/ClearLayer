"use client";

import { ImageItem } from '@/hooks/useBackgroundRemoval';
import { PreviewCard } from './PreviewCard';

interface ImageListProps {
    items: ImageItem[];
    onCrop: (item: ImageItem) => void;
    onRemove: (id: string) => void;
    onEraser: (item: ImageItem) => void;
    onSmartSelect: (item: ImageItem) => void;
}

export function ImageList({ items, onCrop, onRemove, onEraser, onSmartSelect }: ImageListProps) {
    if (items.length === 0) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
            {items.map((item) => (
                <PreviewCard
                    key={item.id}
                    item={item}
                    onCrop={onCrop}
                    onRemove={onRemove}
                    onEraser={onEraser}
                    onSmartSelect={onSmartSelect}
                />
            ))}
        </div>
    );
}

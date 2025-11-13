
import React, { useState, useEffect, useRef, useCallback } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';
import DownloadIcon from './icons/DownloadIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import RotateIcon from './icons/RotateIcon';

interface TurntableGalleryProps {
    title: string;
    views: string[] | null;
    onZoom: (url: string) => void;
    isGenerating: boolean;
}

const DRAG_SENSITIVITY = 40; // Lower value = more sensitive rotation

const TurntableGallery: React.FC<TurntableGalleryProps> = ({ title, views, onZoom, isGenerating }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, index: 0 });

    useEffect(() => {
        setCurrentIndex(0);
    }, [views]);

    const handleDragStart = useCallback((clientX: number) => {
        if (!views || views.length < 2) return;
        setIsDragging(true);
        dragStartRef.current = { x: clientX, index: currentIndex };
        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
    }, [currentIndex, views]);
    
    const handleDragMove = useCallback((clientX: number) => {
        if (!isDragging || !views) return;
        const deltaX = clientX - dragStartRef.current.x;
        const imageOffset = Math.round(deltaX / DRAG_SENSITIVITY);
        
        // The "-" sign makes the rotation feel natural (drag left to see the left side)
        const newIndex = dragStartRef.current.index - imageOffset;
        
        // Wrap the index around the array length
        const wrappedIndex = (newIndex % views.length + views.length) % views.length;
        
        if (wrappedIndex !== currentIndex) {
            setCurrentIndex(wrappedIndex);
        }
    }, [isDragging, views, currentIndex]);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
        document.body.style.userSelect = '';
    }, []);

    if (!views || views.length === 0) {
        return null;
    }

    const currentImage = views[currentIndex];

    const goToPrevious = () => {
        const isFirst = currentIndex === 0;
        const newIndex = isFirst ? views.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    };

    const goToNext = () => {
        const isLast = currentIndex === views.length - 1;
        const newIndex = isLast ? 0 : currentIndex + 1;
        setCurrentIndex(newIndex);
    };

    const downloadImage = () => {
        if (!currentImage) return;
        const link = document.createElement('a');
        link.href = currentImage;
        link.download = `3d-view-${currentIndex + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const angleLabels = ["45°", "90°", "180°", "270°"];

    return (
        <div className="bg-gray-900/50 p-3 rounded-lg shadow-md flex flex-col">
            <h4 className="text-md font-semibold text-cyan-400 mb-2 text-center">{title}</h4>
            <div
                className={`relative aspect-square w-full bg-gray-900 rounded-md overflow-hidden group select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={(e) => handleDragStart(e.clientX)}
                onMouseMove={(e) => handleDragMove(e.clientX)}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
                onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
                onTouchEnd={handleDragEnd}
            >
                {isGenerating ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
                        <SpinnerIcon className="w-10 h-10 text-cyan-400" />
                    </div>
                ) : currentImage ? (
                     <>
                        <img
                            src={currentImage}
                            alt={`${title} - view ${currentIndex + 1}`}
                            className="w-full h-full object-contain pointer-events-none" // prevent img drag
                            key={currentImage} 
                        />
                        {/* Navigation Buttons */}
                        <button onClick={goToPrevious} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/40 rounded-full text-white hover:bg-black/70 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0" aria-label="Góc nhìn trước" disabled={isDragging}>
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        <button onClick={goToNext} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/40 rounded-full text-white hover:bg-black/70 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0" aria-label="Góc nhìn sau" disabled={isDragging}>
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>

                        {/* Zoom and Download Buttons */}
                        <div className="absolute top-2 right-2 flex space-x-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onZoom(currentImage); }} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label="Phóng to">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); downloadImage(); }} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label="Tải xuống">
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Angle Indicator */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full z-10 pointer-events-none">
                            {angleLabels[currentIndex] || `${currentIndex + 1}/${views.length}`}
                        </div>
                        
                        {/* Drag Hint */}
                        <div className={`absolute bottom-2 left-2 right-2 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${isDragging ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}>
                            <div className="flex items-center space-x-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                <RotateIcon className="w-4 h-4" />
                                <span>Kéo để xoay</span>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default TurntableGallery;

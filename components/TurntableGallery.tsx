
import React, { useState, useEffect, useRef, useCallback } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';
import DownloadIcon from './icons/DownloadIcon';
import ShareIcon from './icons/ShareIcon';
import RegenIcon from './icons/RegenIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import ChevronUpIcon from './icons/ChevronUpIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { useLanguage } from '../contexts/LanguageContext';

interface TurntableGalleryProps {
    title: string;
    sheetUrl: string | null;
    onZoom: (url: string) => void;
    onShare: (url: string) => void;
    onReGenerate?: () => void;
    isGenerating: boolean;
}

const QUADRANT_POSITIONS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];

// Helper to crop a quadrant from the sprite sheet and return a data URL
const getCroppedImage = (sheetUrl: string, cropIndex: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = sheetUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }
      
      const quadrantWidth = img.width / 2;
      const quadrantHeight = img.height / 2;
      
      canvas.width = quadrantWidth;
      canvas.height = quadrantHeight;
      
      const sx = (cropIndex % 2) * quadrantWidth;
      const sy = Math.floor(cropIndex / 2) * quadrantHeight;
      
      ctx.drawImage(
        img,
        sx, sy, quadrantWidth, quadrantHeight,
        0, 0, quadrantWidth, quadrantHeight
      );
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (err) => reject(err);
  });
};

const TurntableGallery: React.FC<TurntableGalleryProps> = ({ title, sheetUrl, onZoom, onShare, onReGenerate, isGenerating }) => {
    const { t } = useLanguage();
    // Rotation angle in degrees.
    // 0 = Front, -90 = Right, -180 = Back, -270 = Left
    const [rotationY, setRotationY] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Observe container width to update the 3D translateZ distance dynamically
    useEffect(() => {
        if (!containerRef.current) return;
        
        const updateWidth = () => {
             if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
             }
        };

        const resizeObserver = new ResizeObserver(() => {
             updateWidth();
        });

        resizeObserver.observe(containerRef.current);
        updateWidth(); // Initial call

        return () => resizeObserver.disconnect();
    }, []);

    // Reset rotation when new image loads
    useEffect(() => {
        setRotationY(0);
    }, [sheetUrl]);

    const rotateLeft = () => setRotationY(prev => prev + 90);
    const rotateRight = () => setRotationY(prev => prev - 90);
    const rotateFront = () => setRotationY(0);
    const rotateBack = () => setRotationY(-180);

    const getCurrentIndex = () => {
        // Normalize rotation to 0-360 positive range then divide by 90
        const normalized = ((-rotationY % 360) + 360) % 360;
        const index = Math.round(normalized / 90) % 4;
        return index;
    };
    
    const handleAction = async (action: (url: string) => void) => {
        if (!sheetUrl) return;
        try {
            const currentIndex = getCurrentIndex();
            const croppedUrl = await getCroppedImage(sheetUrl, currentIndex);
            action(croppedUrl);
        } catch (error) {
            console.error("Error cropping image:", error);
            action(sheetUrl);
        }
    }
    
    const downloadImage = async () => {
        if (!sheetUrl) return;
         try {
            const currentIndex = getCurrentIndex();
            const croppedUrl = await getCroppedImage(sheetUrl, currentIndex);
            const link = document.createElement('a');
            link.href = croppedUrl;
            link.download = `3d-view-${angleLabels[currentIndex]}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error preparing image for download:", error);
        }
    };
    
    const angleLabels = [t.viewFront, t.viewRight, t.viewBack, t.viewLeft];
    const currentIndex = getCurrentIndex();
    
    // Calculate translateZ. For a cube, the face is at width/2 distance from center.
    const translateZ = containerWidth / 2;

    if (!sheetUrl && !isGenerating) {
        return null;
    }

    return (
        <div className="bg-gray-900/50 p-4 rounded-xl shadow-lg flex flex-col border border-gray-700">
            <div className="flex justify-between items-center mb-4 relative z-10">
                <h4 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                    <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                    {title}
                </h4>
                <div className="flex gap-2">
                    {onReGenerate && (
                        <button 
                            onClick={onReGenerate} 
                            className="text-gray-400 hover:text-cyan-400 transition-colors p-2 bg-gray-800 rounded-full hover:bg-gray-700" 
                            title={t.regenerate3DViewTooltip}
                        >
                            <RegenIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* 3D Scene Container */}
            <div 
                className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden group perspective-container mb-4"
                ref={containerRef}
                style={{ perspective: '1200px' }}
            >
                {isGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30">
                        <SpinnerIcon className="w-12 h-12 text-cyan-400 mb-2" />
                        <span className="text-cyan-400 font-medium animate-pulse">{t.generating}...</span>
                    </div>
                ) : sheetUrl ? (
                    <div 
                        className="w-full h-full relative preserve-3d transition-transform duration-700 ease-in-out"
                        style={{ 
                            transformStyle: 'preserve-3d',
                            transform: `translateZ(-${translateZ}px) rotateY(${rotationY}deg)`
                        }}
                    >
                        {/* Front Face (0deg) */}
                        <div 
                            className="absolute inset-0 bg-gray-800 backface-hidden"
                            style={{ 
                                backgroundImage: `url(${sheetUrl})`,
                                backgroundSize: '200% 200%',
                                backgroundPosition: QUADRANT_POSITIONS[0],
                                transform: `rotateY(0deg) translateZ(${translateZ}px)`,
                                backfaceVisibility: 'hidden' 
                            }}
                        />
                         {/* Right Face (90deg) */}
                        <div 
                            className="absolute inset-0 bg-gray-800 backface-hidden"
                            style={{ 
                                backgroundImage: `url(${sheetUrl})`,
                                backgroundSize: '200% 200%',
                                backgroundPosition: QUADRANT_POSITIONS[1],
                                transform: `rotateY(90deg) translateZ(${translateZ}px)`,
                                backfaceVisibility: 'hidden'
                            }}
                        />
                        {/* Back Face (180deg) */}
                        <div 
                            className="absolute inset-0 bg-gray-800 backface-hidden"
                            style={{ 
                                backgroundImage: `url(${sheetUrl})`,
                                backgroundSize: '200% 200%',
                                backgroundPosition: QUADRANT_POSITIONS[2],
                                transform: `rotateY(180deg) translateZ(${translateZ}px)`,
                                backfaceVisibility: 'hidden'
                            }}
                        />
                        {/* Left Face (270deg / -90deg) */}
                        <div 
                            className="absolute inset-0 bg-gray-800 backface-hidden"
                            style={{ 
                                backgroundImage: `url(${sheetUrl})`,
                                backgroundSize: '200% 200%',
                                backgroundPosition: QUADRANT_POSITIONS[3],
                                transform: `rotateY(-90deg) translateZ(${translateZ}px)`,
                                backfaceVisibility: 'hidden'
                            }}
                        />
                    </div>
                ) : null}

                {/* Overlay Controls (Zoom, Share, Download) */}
                {sheetUrl && !isGenerating && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                         <button onClick={(e) => { e.stopPropagation(); handleAction(onZoom); }} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm" title={t.zoom}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                        </button>
                         <button onClick={(e) => { e.stopPropagation(); handleAction(onShare); }} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm" title={t.share}>
                            <ShareIcon className="w-5 h-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); downloadImage(); }} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur-sm" title={t.download}>
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
                
                {/* Angle Label */}
                {sheetUrl && !isGenerating && (
                    <div className="absolute top-4 left-4 z-20">
                         <div className="bg-black/60 text-cyan-400 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm border border-cyan-500/30 shadow-lg">
                            {angleLabels[currentIndex]}
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Pad Control */}
            {sheetUrl && !isGenerating && (
                <div className="flex justify-center items-center mt-2">
                    <div className="relative w-32 h-32 bg-gray-800 rounded-xl shadow-inner border border-gray-700 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-700/50 to-transparent rounded-xl pointer-events-none" />
                        
                        {/* Up Button (Front) */}
                        <button 
                            onClick={rotateFront}
                            className="absolute top-2 left-1/2 -translate-x-1/2 p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700/50 rounded-lg transition-all active:scale-95"
                            title={t.viewFront}
                        >
                            <ChevronUpIcon className="w-6 h-6" />
                        </button>

                        {/* Down Button (Back) */}
                        <button 
                            onClick={rotateBack}
                            className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700/50 rounded-lg transition-all active:scale-95"
                            title={t.viewBack}
                        >
                            <ChevronDownIcon className="w-6 h-6" />
                        </button>

                        {/* Left Button (Rotate Left) */}
                        <button 
                            onClick={rotateLeft}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700/50 rounded-lg transition-all active:scale-95"
                            title="Rotate Left"
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>

                        {/* Right Button (Rotate Right) */}
                        <button 
                            onClick={rotateRight}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700/50 rounded-lg transition-all active:scale-95"
                            title="Rotate Right"
                        >
                            <ChevronRightIcon className="w-6 h-6" />
                        </button>

                        {/* Center Decor */}
                        <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-600 shadow-inner flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TurntableGallery;

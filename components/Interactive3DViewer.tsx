
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GenerationParams } from '../types';
import { generate3DViewAngle } from '../services/geminiService';
import SpinnerIcon from './icons/SpinnerIcon';
import DownloadIcon from './icons/DownloadIcon';
import RotateIcon from './icons/RotateIcon';

interface Interactive3DViewerProps {
    title: string;
    initialImageUrl: string | null;
    basePortrait: string | null;
    generationParams: GenerationParams | null;
    onZoom: (url: string) => void;
    isGenerating: boolean;
}

const Interactive3DViewer: React.FC<Interactive3DViewerProps> = ({ title, initialImageUrl, basePortrait, generationParams, onZoom, isGenerating }) => {
    const [displayImage, setDisplayImage] = useState<string | null>(initialImageUrl);
    const [isLoading, setIsLoading] = useState(false);
    const [currentAngle, setCurrentAngle] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, angle: 0 });

    useEffect(() => {
        setDisplayImage(initialImageUrl);
        setCurrentAngle(0); // Reset angle when a new character is generated
    }, [initialImageUrl]);

    const handleRotation = useCallback(async (newAngle: number) => {
        if (!basePortrait || !generationParams) return;

        setIsLoading(true);
        setError(null);
        try {
            const newImage = await generate3DViewAngle(basePortrait, generationParams, newAngle);
            setDisplayImage(newImage);
        } catch (err: any) {
            setError(err.message || 'Lỗi xoay ảnh.');
            // Revert angle on failure
            setCurrentAngle(currentAngle);
        } finally {
            setIsLoading(false);
        }
    }, [basePortrait, generationParams, currentAngle]);

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, angle: currentAngle };
        document.body.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const deltaX = e.clientX - dragStartRef.current.x;
        // Sensitivity factor for rotation speed
        const newAngle = dragStartRef.current.angle - deltaX * 0.5;
        setCurrentAngle(newAngle);
    };

    const onMouseUp = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        isDraggingRef.current = false;
        document.body.style.cursor = 'default';

        // Normalize angle to 0-360 range
        const finalAngle = (Math.round(currentAngle) % 360 + 360) % 360;
        setCurrentAngle(finalAngle);
        handleRotation(finalAngle);
    };

    const downloadImage = () => {
        if (!displayImage) return;
        const link = document.createElement('a');
        link.href = displayImage;
        link.download = `3d-view-${Math.round(currentAngle)}deg.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-gray-900/50 p-3 rounded-lg shadow-md flex flex-col">
            <h4 className="text-md font-semibold text-cyan-400 mb-2 text-center">{title}</h4>
            <div
                className="relative aspect-auto flex-grow w-full bg-gray-900 rounded-md overflow-hidden group"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp} // End drag if mouse leaves the component
            >
                {(isGenerating || isLoading) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                        <SpinnerIcon className="w-10 h-10 text-cyan-400" />
                    </div>
                )}
                {displayImage ? (
                     <>
                        <img
                            src={displayImage}
                            alt={`${title} - ${currentAngle.toFixed(0)}°`}
                            className={`w-full h-full object-contain transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}
                            draggable="false"
                        />
                         <div
                            className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 
                                ${isDraggingRef.current ? 'bg-transparent' : 'bg-black/60'}`}
                        >
                            <div className="flex space-x-4">
                                <button onClick={() => onZoom(displayImage)} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label="Phóng to">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                </button>
                                <button onClick={downloadImage} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label="Tải xuống">
                                    <DownloadIcon className="w-6 h-6" />
                                </button>
                            </div>
                         </div>
                         <div
                             className={`absolute bottom-2 left-2 right-2 flex items-center justify-center transition-opacity duration-300
                                ${isDraggingRef.current ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}
                         >
                            <div className="flex items-center space-x-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                <RotateIcon className="w-4 h-4" />
                                <span>Kéo để xoay</span>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
            {error && <p className="text-red-500 text-xs text-center mt-1">{error}</p>}
        </div>
    );
};

export default Interactive3DViewer;

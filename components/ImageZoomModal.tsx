
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import DownloadIcon from './icons/DownloadIcon';
import ShareIcon from './icons/ShareIcon';

interface ImageZoomModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageUrl, onClose }) => {
  const { t } = useLanguage();
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Reset transform when image changes or modal is closed
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [imageUrl]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (imageUrl) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageUrl, onClose]);


  if (!imageUrl) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPos.current = {
      x: e.clientX - transform.x,
      y: e.clientY - transform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    }));
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.5, transform.scale + scaleAmount), 5);
    
    if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newX = transform.x - mouseX * (newScale / transform.scale - 1);
        const newY = transform.y - mouseY * (newScale / transform.scale - 1);

        setTransform({ scale: newScale, x: newX, y: newY });
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
      e.stopPropagation();
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `zoomed-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'share-image.png', { type: blob.type });

          if (navigator.share && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  title: 'Comic Character',
                  files: [file],
              });
          } else {
              await navigator.clipboard.writeText(imageUrl);
              alert(t.shareFallback); // Simple fallback alert for modal context
          }
      } catch (error) {
          console.error('Share failed', error);
      }
  };


  return (
    <div
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.imageViewer}
    >
      {/* Top Controls */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-cyan-400 text-4xl font-bold transition-colors z-50 p-2"
        aria-label={t.close}
      >
        &times;
      </button>

      {/* Main Image Area */}
      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the pan area
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={t.zoomedInImageAlt}
          className={`max-w-full max-h-full transition-transform duration-75 ease-out ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ 
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            willChange: 'transform'
          }}
          onMouseDown={handleMouseDown}
          draggable={false}
        />
      </div>

      {/* Bottom Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-800/80 backdrop-blur-md px-6 py-3 rounded-full border border-gray-700 shadow-2xl z-50" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 text-gray-200 hover:text-cyan-400 transition-colors group"
            title={t.share}
          >
              <ShareIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">{t.share}</span>
          </button>
          
          <div className="w-px h-6 bg-gray-600"></div>

          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 text-gray-200 hover:text-cyan-400 transition-colors group"
            title={t.download}
          >
              <DownloadIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">{t.download}</span>
          </button>
      </div>
    </div>
  );
};

export default ImageZoomModal;

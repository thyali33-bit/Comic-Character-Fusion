import React, { useState, useRef, useEffect } from 'react';

interface ImageZoomModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageUrl, onClose }) => {
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


  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Trình xem ảnh"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-cyan-400 transition-colors z-50"
        aria-label="Đóng"
      >
        &times;
      </button>

      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the pan area
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Ảnh phóng to"
          className={`max-w-full max-h-full transition-transform duration-75 ease-out ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ 
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            willChange: 'transform'
          }}
          onMouseDown={handleMouseDown}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default ImageZoomModal;
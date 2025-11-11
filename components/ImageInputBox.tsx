
import React, { useRef } from 'react';
import UploadIcon from './icons/UploadIcon';

interface ImageInputBoxProps {
  title: string;
  step: number;
  imagePreviewUrl: string | null;
  onImageChange: (file: File) => void;
  children?: React.ReactNode;
}

const ImageInputBox: React.FC<ImageInputBoxProps> = ({ title, step, imagePreviewUrl, onImageChange, children }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageChange(file);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col h-full">
      <h3 className="text-lg font-bold text-cyan-400 mb-2 flex items-center">
        <span className="bg-cyan-500 text-gray-900 rounded-full h-6 w-6 flex items-center justify-center mr-2 font-mono">{step}</span>
        {title}
      </h3>
      <div
        className="relative flex-grow border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center cursor-pointer hover:border-cyan-500 transition-colors duration-300 group bg-gray-900/50"
        onClick={handleBoxClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
        {imagePreviewUrl ? (
          <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-contain rounded-md" />
        ) : (
          <div className="text-center text-gray-500 group-hover:text-cyan-400 transition-colors">
            <UploadIcon className="w-12 h-12 mx-auto" />
            <p>Click to upload image</p>
          </div>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default ImageInputBox;

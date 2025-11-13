
import React, { useState, useCallback } from 'react';
import { Accessories, InfluenceValues, GenerationParams } from './types';
import { generateCharacterAssets, generateVariationAssets } from './services/geminiService';
import ImageInputBox from './components/ImageInputBox';
import SpinnerIcon from './components/icons/SpinnerIcon';
import ImageZoomModal from './components/ImageZoomModal';
import DownloadIcon from './components/icons/DownloadIcon';
import ResetIcon from './components/icons/ResetIcon';
import TurntableGallery from './components/TurntableGallery';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const FeatureCheckbox: React.FC<{ label: string; checked: boolean; onChange: () => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
    <label className={`flex items-center space-x-3 text-gray-300 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-white'}`}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600 rounded" />
        <span>{label}</span>
    </label>
);

const InfluenceSlider: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">{label}: {value}%</label>
        <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-thumb-cyan"
            style={{
                '--thumb-color': '#22d3ee',
                '--track-color': '#374151'
            } as React.CSSProperties}
        />
    </div>
);

const App: React.FC = () => {
    const [faceImage, setFaceImage] = useState<string | null>(null);
    const [styleImage, setStyleImage] = useState<string | null>(null);
    const [clothingImage, setClothingImage] = useState<string | null>(null);
    
    const [accessories, setAccessories] = useState<Accessories>({
        bracelets: false,
        necklaces: false,
        earrings: false,
        eyeglasses: false,
    });
    
    const [influences, setInfluences] = useState<InfluenceValues>({
        character: 70,
        clothing: 70,
        style: 70,
    });
    
    const [orthoPose, setOrthoPose] = useState('standing');
    const [angledPose, setAngledPose] = useState('random');
    const [facialExpression, setFacialExpression] = useState('neutral');
    const [facialExpressionIntensity, setFacialExpressionIntensity] = useState(50);
    const [quality, setQuality] = useState('standard');
    
    const [generatedPortrait, setGeneratedPortrait] = useState<string | null>(null);
    const [generatedOrthoSheet, setGeneratedOrthoSheet] = useState<string | null>(null);
    const [generatedAngledSheet, setGeneratedAngledSheet] = useState<string | null>(null);
    const [generatedTurntableViews, setGeneratedTurntableViews] = useState<string[] | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    const [lastGenerationParams, setLastGenerationParams] = useState<GenerationParams | null>(null);
    const [variationStrength, setVariationStrength] = useState(30);
    const [isVarying, setIsVarying] = useState(false);

    const [seed, setSeed] = useState<number | null>(null);
    const [useRandomSeed, setUseRandomSeed] = useState(true);

    const handleImageChange = (setter: React.Dispatch<React.SetStateAction<string | null>>) => async (file: File) => {
        try {
            const base64 = await fileToBase64(file);
            setter(base64);
        } catch (error) {
            console.error("Error converting file to base64:", error);
            setError("Lỗi xử lý tệp. Vui lòng thử lại.");
        }
    };
    
    const handleAccessoryChange = (key: keyof Accessories) => {
        setAccessories(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleInfluenceChange = (key: keyof InfluenceValues) => (value: number) => {
        setInfluences(prev => ({ ...prev, [key]: value }));
    };

    const handleReset = () => {
        setFaceImage(null);
        setStyleImage(null);
        setClothingImage(null);
        setAccessories({
            bracelets: false,
            necklaces: false,
            earrings: false,
            eyeglasses: false,
        });
        setInfluences({
            character: 70,
            clothing: 70,
            style: 70,
        });
        setOrthoPose('standing');
        setAngledPose('random');
        setFacialExpression('neutral');
        setFacialExpressionIntensity(50);
        setQuality('standard');
        setGeneratedPortrait(null);
        setGeneratedOrthoSheet(null);
        setGeneratedAngledSheet(null);
        setGeneratedTurntableViews(null);
        setError(null);
        setLastGenerationParams(null);
        setVariationStrength(30);
        setSeed(null);
        setUseRandomSeed(true);
    };
    
    const handleGenerate = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const currentSeed = useRandomSeed ? Math.floor(Math.random() * 1000000) : seed;
        setSeed(currentSeed);

        const params: GenerationParams = {
            faceImage,
            styleImage,
            clothingImage,
            accessories,
            influences,
            orthoPose,
            angledPose,
            facialExpression,
            facialExpressionIntensity,
            seed: currentSeed,
            quality,
        };
        setLastGenerationParams(params);

        try {
            const { portrait, orthoSheet, angledSheet, turntableViews } = await generateCharacterAssets(
                params.faceImage,
                params.styleImage,
                params.clothingImage,
                params.accessories,
                params.influences,
                params.orthoPose,
                params.angledPose,
                params.facialExpression,
                params.facialExpressionIntensity,
                params.seed,
                params.quality,
            );
            setGeneratedPortrait(portrait);
            setGeneratedOrthoSheet(orthoSheet);
            setGeneratedAngledSheet(angledSheet);
            setGeneratedTurntableViews(turntableViews);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi không xác định. Vui lòng kiểm tra bảng điều khiển để biết thêm chi tiết.');
        } finally {
            setIsLoading(false);
        }
    }, [faceImage, styleImage, clothingImage, accessories, influences, orthoPose, angledPose, facialExpression, facialExpressionIntensity, seed, useRandomSeed, quality]);

    const handleGenerateVariation = useCallback(async () => {
        if (!generatedPortrait || !lastGenerationParams) return;

        setIsVarying(true);
        setError(null);
        
        const currentSeed = useRandomSeed ? Math.floor(Math.random() * 1000000) : seed;
        setSeed(currentSeed);
        
        try {
            const { portrait, orthoSheet, angledSheet, turntableViews } = await generateVariationAssets(
                generatedPortrait,
                variationStrength,
                lastGenerationParams,
                currentSeed,
            );
            setGeneratedPortrait(portrait);
            setGeneratedOrthoSheet(orthoSheet);
            setGeneratedAngledSheet(angledSheet);
            setGeneratedTurntableViews(turntableViews);

            setLastGenerationParams(prev => prev ? {...prev, seed: currentSeed } : null);

        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi khi tạo biến thể.');
        } finally {
            setIsVarying(false);
        }
    }, [generatedPortrait, lastGenerationParams, variationStrength, seed, useRandomSeed]);
    
    const downloadImage = (imageUrl: string | null, filename: string) => {
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 font-sans">
            <style>{`
                .range-thumb-cyan::-webkit-slider-thumb { background: var(--thumb-color); }
                .range-thumb-cyan::-moz-range-thumb { background: var(--thumb-color); }
            `}</style>
            
            <ImageZoomModal imageUrl={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />

            <header className="text-center mb-8">
                <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                    Comic Character Fusion
                </h1>
                <p className="mt-2 text-gray-400 max-w-2xl mx-auto">
                    Thiết kế nhân vật truyện tranh độc đáo bằng cách kết hợp các đặc điểm từ hình ảnh tham khảo. Tải lên hình ảnh khuôn mặt, trang phục và phong cách để tạo ra một nhân vật hoàn toàn mới.
                </p>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700">
                    <h2 className="text-2xl font-semibold mb-6 text-teal-400 border-b-2 border-gray-700 pb-2">Bảng điều khiển</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <ImageInputBox title="Khuôn mặt nhân vật" step={1} imagePreviewUrl={faceImage} onImageChange={handleImageChange(setFaceImage)} />
                        <ImageInputBox title="Trang phục" step={2} imagePreviewUrl={clothingImage} onImageChange={handleImageChange(setClothingImage)}>
                           {clothingImage && (
                                <div className="space-y-2 mt-3 p-3 bg-gray-900/50 rounded-md">
                                    <h4 className="text-sm font-semibold text-cyan-400">Giữ lại phụ kiện:</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <FeatureCheckbox label="Vòng tay" checked={accessories.bracelets} onChange={() => handleAccessoryChange('bracelets')} />
                                        <FeatureCheckbox label="Vòng cổ" checked={accessories.necklaces} onChange={() => handleAccessoryChange('necklaces')} />
                                        <FeatureCheckbox label="Khuyên tai" checked={accessories.earrings} onChange={() => handleAccessoryChange('earrings')} />
                                        <FeatureCheckbox label="Kính mắt" checked={accessories.eyeglasses} onChange={() => handleAccessoryChange('eyeglasses')} />
                                    </div>
                                </div>
                            )}
                        </ImageInputBox>
                        <ImageInputBox title="Phong cách nghệ thuật" step={3} imagePreviewUrl={styleImage} onImageChange={handleImageChange(setStyleImage)} />
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6">
                        <h3 className="text-lg font-bold text-cyan-400 mb-4">Mức độ ảnh hưởng</h3>
                        <InfluenceSlider label="Nhân vật" value={influences.character} onChange={handleInfluenceChange('character')} />
                        <InfluenceSlider label="Trang phục" value={influences.clothing} onChange={handleInfluenceChange('clothing')} />
                        <InfluenceSlider label="Phong cách" value={influences.style} onChange={handleInfluenceChange('style')} />
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6">
                        <h3 className="text-lg font-bold text-cyan-400 mb-4">Tùy chọn tạo hình</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="quality" className="block text-sm font-medium text-gray-300 mb-2">Chất lượng ảnh</label>
                                <select id="quality" value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500">
                                    <option value="standard">Tiêu chuẩn</option>
                                    <option value="hd">HD</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="ortho-pose" className="block text-sm font-medium text-gray-300 mb-2">Tư thế trực giao</label>
                                <select id="ortho-pose" value={orthoPose} onChange={e => setOrthoPose(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500">
                                    <option value="standing">Đứng</option>
                                    <option value="sitting">Ngồi</option>
                                    <option value="lying down">Nằm</option>
                                    <option value="jumping">Nhảy</option>
                                    <option value="bowing">Cúi chào</option>
                                    <option value="random">Ngẫu nhiên</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="angled-pose" className="block text-sm font-medium text-gray-300 mb-2">Tư thế phối cảnh</label>
                                <select id="angled-pose" value={angledPose} onChange={e => setAngledPose(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500">
                                    <option value="random">Ngẫu nhiên</option>
                                    <option value="standing">Đứng</option>
                                    <option value="sitting">Ngồi</option>
                                    <option value="lying down">Nằm</option>
                                    <option value="jumping">Nhảy</option>
                                    <option value="bowing">Cúi chào</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="facial-expression" className="block text-sm font-medium text-gray-300 mb-2">Biểu cảm</label>
                                <select id="facial-expression" value={facialExpression} onChange={e => setFacialExpression(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500" disabled={!faceImage && facialExpression === 'from_face_reference'}>
                                    <option value="neutral">Trung tính</option>
                                    <option value="from_face_reference" disabled={!faceImage}>Từ ảnh khuôn mặt</option>
                                    <option value="happy">Vui vẻ</option>
                                    <option value="sad">Buồn</option>
                                    <option value="angry">Tức giận</option>
                                    <option value="surprised">Ngạc nhiên</option>
                                    <option value="determined">Quyết tâm</option>
                                    <option value="smirking">Cười nhếch mép</option>
                                </select>
                            </div>
                        </div>
                         {facialExpression !== 'neutral' && facialExpression !== 'from_face_reference' && (
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Cường độ biểu cảm: {facialExpressionIntensity}%</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={facialExpressionIntensity}
                                    onChange={(e) => setFacialExpressionIntensity(parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-thumb-cyan"
                                    style={{ '--thumb-color': '#22d3ee' } as React.CSSProperties}
                                />
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6">
                        <h3 className="text-lg font-bold text-cyan-400 mb-4">Hạt giống (Seed)</h3>
                        <div className="flex items-center space-x-4">
                            <input
                                type="number"
                                placeholder="Seed (tùy chọn)"
                                value={seed ?? ''}
                                onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value, 10) : null)}
                                disabled={useRandomSeed}
                                className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500 disabled:opacity-50"
                            />
                             <label className="flex items-center space-x-2 text-gray-300 whitespace-nowrap">
                                <input type="checkbox" checked={useRandomSeed} onChange={() => setUseRandomSeed(!useRandomSeed)} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600 rounded" />
                                <span>Ngẫu nhiên</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || isVarying}
                            className="flex-grow bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <SpinnerIcon className="w-5 h-5 mr-3" />
                                    Đang tạo...
                                </>
                            ) : (
                                'Tạo nhân vật'
                            )}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={isLoading || isVarying}
                            className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            aria-label="Đặt lại tất cả cài đặt"
                        >
                            <ResetIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                </div>

                <div className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700 flex flex-col items-center justify-center min-h-[60vh]">
                    {!generatedPortrait && !isLoading && (
                        <div className="text-center text-gray-500">
                            <svg className="w-24 h-24 mx-auto text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <h3 className="mt-4 text-xl font-semibold">Kết quả sẽ xuất hiện ở đây</h3>
                            <p className="mt-1 text-gray-400">Thiết lập các tùy chọn của bạn và nhấn "Tạo nhân vật".</p>
                        </div>
                    )}
                    {isLoading && !generatedPortrait && (
                         <div className="text-center text-gray-400">
                            <SpinnerIcon className="w-16 h-16 mx-auto mb-4 text-cyan-500" />
                            <p className="text-lg animate-pulse">Đang triệu hồi nghệ sĩ AI...</p>
                            <p className="text-sm mt-2">Quá trình này có thể mất một chút thời gian, đặc biệt là với hình ảnh chất lượng cao.</p>
                        </div>
                    )}
                    {generatedPortrait && (
                        <div className="w-full space-y-6">
                           <h2 className="text-2xl font-semibold text-teal-400 border-b-2 border-gray-700 pb-2 text-center">Kết quả</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <GeneratedImage title="Chân dung" imageUrl={generatedPortrait} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedPortrait, 'portrait.png')} isLoading={isLoading} />
                                <GeneratedImage title="Bản vẽ trực giao" imageUrl={generatedOrthoSheet} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedOrthoSheet, 'ortho-sheet.png')} isLoading={isLoading} />
                                <GeneratedImage title="Bản vẽ phối cảnh" imageUrl={generatedAngledSheet} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedAngledSheet, 'angled-sheet.png')} isLoading={isLoading} />
                            </div>

                            <div className="md:col-span-2 lg:col-span-3">
                                {generatedTurntableViews && generatedTurntableViews.length > 0 && (
                                     <TurntableGallery
                                        title="Góc nhìn 3D"
                                        views={generatedTurntableViews}
                                        onZoom={setZoomedImageUrl}
                                        isGenerating={isLoading}
                                    />
                                )}
                            </div>

                             <div className="bg-gray-800 p-4 rounded-lg shadow-inner mt-6">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4">Tạo biến thể</h3>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Mức độ biến đổi: {variationStrength}%</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={variationStrength}
                                        onChange={(e) => setVariationStrength(parseInt(e.target.value, 10))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-thumb-cyan"
                                        style={{ '--thumb-color': '#22d3ee' } as React.CSSProperties}
                                    />
                                </div>
                                <button
                                    onClick={handleGenerateVariation}
                                    disabled={isVarying || isLoading}
                                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center"
                                >
                                    {isVarying ? (
                                        <>
                                            <SpinnerIcon className="w-5 h-5 mr-3" />
                                            Đang biến đổi...
                                        </>
                                    ) : (
                                        'Tạo biến thể mới'
                                    )}
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};


interface GeneratedImageProps {
    title: string;
    imageUrl: string | null;
    onZoom: (url: string) => void;
    onDownload: () => void;
    isLoading: boolean;
}

const GeneratedImage: React.FC<GeneratedImageProps> = ({ title, imageUrl, onZoom, onDownload, isLoading }) => {
    return (
        <div className="bg-gray-900/50 p-3 rounded-lg shadow-md flex flex-col">
            <h4 className="text-md font-semibold text-cyan-400 mb-2 text-center">{title}</h4>
            <div className="relative aspect-square flex-grow w-full bg-gray-900 rounded-md overflow-hidden group">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <SpinnerIcon className="w-10 h-10 text-cyan-400" />
                    </div>
                ) : imageUrl ? (
                     <>
                        <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="flex space-x-4">
                                <button onClick={() => onZoom(imageUrl)} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label="Phóng to">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                </button>
                                <button onClick={onDownload} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label="Tải xuống">
                                    <DownloadIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default App;


import React, { useState, useCallback } from 'react';
import { Accessories, InfluenceValues } from './types';
import { generateCharacterAssets } from './services/geminiService';
import ImageInputBox from './components/ImageInputBox';
import SpinnerIcon from './components/icons/SpinnerIcon';
import ImageZoomModal from './components/ImageZoomModal';
import DownloadIcon from './components/icons/DownloadIcon';

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

const OutputDisplay: React.FC<{
    assets: { portrait: string | null; orthoSheet: string | null; angledSheet: string | null; };
    onImageClick: (url: string) => void;
}> = ({ assets, onImageClick }) => {
    if (!assets.portrait || !assets.orthoSheet || !assets.angledSheet) {
        return null;
    }
    
    const getExtensionFromBase64 = (base64: string): string => {
        return base64.substring(base64.indexOf('/') + 1, base64.indexOf(';base64'));
    };

    const handleDownload = (base64Url: string, filename: string) => {
        const extension = getExtensionFromBase64(base64Url);
        const link = document.createElement('a');
        link.href = base64Url;
        link.download = `${filename}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const outputBoxClasses = "relative bg-gray-800/50 rounded-xl p-4 flex flex-col items-center shadow-lg group transition-all duration-300 hover:bg-gray-800 hover:ring-2 hover:ring-cyan-500/80";
    const imageClasses = "w-full h-auto object-contain rounded-lg transition-transform duration-300 group-hover:scale-105";
    const titleClasses = "text-xl font-bold text-cyan-400 mb-3 w-full text-center";
    const downloadButtonClasses = "absolute top-3 right-3 p-2 rounded-full bg-gray-900/50 hover:bg-cyan-500 text-gray-300 hover:text-white transition-all z-10";

    return (
        <div className="w-full h-full p-4 animate-[fadeIn_0.5s_ease-in-out] overflow-y-auto">
            <div className="flex flex-col gap-8">
                
                {/* Main Portrait */}
                <div 
                    className={outputBoxClasses}
                    onClick={() => onImageClick(assets.portrait!)}
                >
                    <h3 className={titleClasses}>Chân dung Nhân vật</h3>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(assets.portrait!, 'chan-dung-nhan-vat');
                        }}
                        className={downloadButtonClasses}
                        aria-label="Tải xuống chân dung"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                    <div className="w-full max-w-md cursor-pointer">
                        <img 
                            src={assets.portrait} 
                            alt="Chân dung được tạo" 
                            className={imageClasses}
                        />
                    </div>
                </div>

                {/* Ortho Sheet */}
                <div 
                    className={outputBoxClasses}
                    onClick={() => onImageClick(assets.orthoSheet!)}
                >
                    <h3 className={titleClasses}>Bản vẽ trực giao</h3>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(assets.orthoSheet!, 'ban-ve-truc-giao');
                        }}
                        className={downloadButtonClasses}
                        aria-label="Tải xuống bản vẽ trực giao"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                     <div className="w-full cursor-pointer">
                        <img 
                            src={assets.orthoSheet} 
                            alt="Bản vẽ trực giao" 
                            className={imageClasses} 
                        />
                    </div>
                </div>
                
                {/* Angled Sheet */}
                 <div 
                    className={outputBoxClasses}
                    onClick={() => onImageClick(assets.angledSheet!)}
                >
                    <h3 className={titleClasses}>Bản vẽ phối cảnh</h3>
                     <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(assets.angledSheet!, 'ban-ve-phoi-canh');
                        }}
                        className={downloadButtonClasses}
                        aria-label="Tải xuống bản vẽ phối cảnh"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                     <div className="w-full cursor-pointer">
                        <img 
                            src={assets.angledSheet} 
                            alt="Bản vẽ phối cảnh" 
                            className={imageClasses}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    const [faceImage, setFaceImage] = useState<string | null>(null);
    const [clothingImage, setClothingImage] = useState<string | null>(null);
    const [styleImage, setStyleImage] = useState<string | null>(null);

    const [accessories, setAccessories] = useState<Accessories>({
        bracelets: false,
        necklaces: false,
        earrings: false,
        eyeglasses: false,
    });

    const [influences, setInfluences] = useState<InfluenceValues>({
        character: 100,
        clothing: 100,
        style: 100,
    });

    const [orthoPose, setOrthoPose] = useState<string>('standing');
    const [angledPose, setAngledPose] = useState<string>('random');
    const [facialExpression, setFacialExpression] = useState<string>('neutral');
    const [facialExpressionIntensity, setFacialExpressionIntensity] = useState<number>(75);

    
    const [generatedAssets, setGeneratedAssets] = useState<{
        portrait: string | null;
        orthoSheet: string | null;
        angledSheet: string | null;
    }>({ portrait: null, orthoSheet: null, angledSheet: null });

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);


    const handleImageChange = (setter: React.Dispatch<React.SetStateAction<string | null>>) => async (file: File) => {
        const base64 = await fileToBase64(file);
        setter(base64);
    };
    
    const handleAccessoryChange = (accessory: keyof Accessories) => {
        setAccessories(prev => ({ ...prev, [accessory]: !prev[accessory] }));
    };

    const handleInfluenceChange = (type: keyof InfluenceValues, value: number) => {
        setInfluences(prev => ({ ...prev, [type]: value }));
    };

    const handleGenerateClick = useCallback(async () => {
        if (!faceImage && !styleImage && !clothingImage) {
            setError("Vui lòng tải lên ít nhất một hình ảnh tham chiếu để bắt đầu.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedAssets({ portrait: null, orthoSheet: null, angledSheet: null });

        try {
            const result = await generateCharacterAssets(faceImage, styleImage, clothingImage, accessories, influences, orthoPose, angledPose, facialExpression, facialExpressionIntensity);
            setGeneratedAssets(result);
        } catch (err: any) {
            setError(err.message || "Đã xảy ra lỗi không xác định.");
        } finally {
            setIsLoading(false);
        }
    }, [faceImage, styleImage, clothingImage, accessories, influences, orthoPose, angledPose, facialExpression, facialExpressionIntensity]);

    const isGenerateDisabled = (!faceImage && !styleImage && !clothingImage) || isLoading;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8">
             <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                /* Custom scrollbar for webkit browsers */
                .overflow-y-auto::-webkit-scrollbar {
                    width: 8px;
                }
                .overflow-y-auto::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb {
                    background: #06b6d4; /* cyan-500 */
                    border-radius: 10px;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                    background: #0891b2; /* cyan-600 */
                }
            `}</style>
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                            Hợp Nhất Nhân Vật Truyện Tranh
                        </span>
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">Thiết kế anh hùng. Định hình phong cách. Sáng tạo nhân vật với AI.</p>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* INPUTS PANEL */}
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                        <ImageInputBox title="Khuôn mặt Nhân vật" step={1} imagePreviewUrl={faceImage} onImageChange={handleImageChange(setFaceImage)}>
                             <div className="mt-4 pt-4 border-t border-gray-700">
                                <label htmlFor="characterInfluence" className="text-sm font-semibold text-gray-400 block mb-2">Mức độ ảnh hưởng: Nhân vật <span className="font-mono bg-gray-700 px-2 py-1 rounded">{influences.character}%</span></label>
                                <input
                                id="characterInfluence"
                                type="range"
                                min="0"
                                max="100"
                                value={influences.character}
                                onChange={(e) => handleInfluenceChange('character', parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </ImageInputBox>
                        <ImageInputBox title="Trang phục & Phụ kiện" step={2} imagePreviewUrl={clothingImage} onImageChange={handleImageChange(setClothingImage)}>
                           <div className="space-y-3">
                                <p className="text-sm font-semibold text-gray-400">Giữ lại các phụ kiện:</p>
                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                    <FeatureCheckbox label="Vòng tay" checked={accessories.bracelets} onChange={() => handleAccessoryChange('bracelets')} disabled={!clothingImage} />
                                    <FeatureCheckbox label="Vòng cổ" checked={accessories.necklaces} onChange={() => handleAccessoryChange('necklaces')} disabled={!clothingImage} />
                                    <FeatureCheckbox label="Khuyên tai" checked={accessories.earrings} onChange={() => handleAccessoryChange('earrings')} disabled={!clothingImage} />
                                    <FeatureCheckbox label="Mắt kính" checked={accessories.eyeglasses} onChange={() => handleAccessoryChange('eyeglasses')} disabled={!clothingImage} />
                                </div>
                            </div>
                             <div className="mt-4 pt-4 border-t border-gray-700">
                                <label htmlFor="clothingInfluence" className="text-sm font-semibold text-gray-400 block mb-2">Mức độ ảnh hưởng: Trang phục <span className="font-mono bg-gray-700 px-2 py-1 rounded">{influences.clothing}%</span></label>
                                <input
                                id="clothingInfluence"
                                type="range"
                                min="0"
                                max="100"
                                value={influences.clothing}
                                onChange={(e) => handleInfluenceChange('clothing', parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </ImageInputBox>
                        <ImageInputBox title="Phong cách Vẽ" step={3} imagePreviewUrl={styleImage} onImageChange={handleImageChange(setStyleImage)}>
                            <div className="mt-0 pt-4 border-t border-gray-700">
                                <label htmlFor="styleInfluence" className="text-sm font-semibold text-gray-400 block mb-2">Mức độ ảnh hưởng: Phong cách <span className="font-mono bg-gray-700 px-2 py-1 rounded">{influences.style}%</span></label>
                                <input
                                id="styleInfluence"
                                type="range"
                                min="0"
                                max="100"
                                value={influences.style}
                                onChange={(e) => handleInfluenceChange('style', parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </ImageInputBox>
                    </div>

                    {/* OUTPUT & CONTROLS PANEL */}
                    <div className="bg-gray-800/50 p-6 rounded-lg shadow-2xl flex flex-col sticky top-8 h-[calc(100vh-4rem)]">
                        <h2 className="text-2xl font-bold text-cyan-400 mb-4">Điều khiển & Kết quả</h2>

                        <div className="mb-4">
                            <label htmlFor="expression-select" className="block text-sm font-medium text-gray-300 mb-2">Biểu cảm Khuôn mặt</label>
                            <div className="relative">
                                <select
                                    id="expression-select"
                                    value={facialExpression}
                                    onChange={(e) => setFacialExpression(e.target.value)}
                                    className="w-full appearance-none bg-gray-700 border border-gray-600 text-white py-2 px-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                >
                                    <option value="neutral">Trung tính</option>
                                    <option value="from_face_reference" disabled={!faceImage}>Theo khuôn mặt mẫu</option>
                                    <option value="happy">Vui vẻ</option>
                                    <option value="sad">Buồn</option>
                                    <option value="angry">Tức giận</option>
                                    <option value="surprised">Ngạc nhiên</option>
                                    <option value="smug">Tự mãn</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>

                         <div className="mb-4">
                            <label htmlFor="expressionIntensity" className="text-sm font-semibold text-gray-400 block mb-2">Cường độ Biểu cảm <span className="font-mono bg-gray-700 px-2 py-1 rounded">{facialExpressionIntensity}%</span></label>
                            <input
                            id="expressionIntensity"
                            type="range"
                            min="0"
                            max="100"
                            value={facialExpressionIntensity}
                            onChange={(e) => setFacialExpressionIntensity(parseInt(e.target.value, 10))}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={facialExpression === 'neutral' || facialExpression === 'from_face_reference'}
                            />
                        </div>


                        <div className="mb-4">
                            <label htmlFor="pose-select" className="block text-sm font-medium text-gray-300 mb-2">Tư thế (Bản vẽ trực giao)</label>
                            <div className="relative">
                                <select
                                    id="pose-select"
                                    value={orthoPose}
                                    onChange={(e) => setOrthoPose(e.target.value)}
                                    className="w-full appearance-none bg-gray-700 border border-gray-600 text-white py-2 px-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                >
                                    <option value="standing">Đứng (Tư thế A)</option>
                                    <option value="sitting">Ngồi</option>
                                    <option value="lying down">Nằm</option>
                                    <option value="jumping">Nhảy cao</option>
                                    <option value="bowing">Cúi chào</option>
                                    <option value="random">Ngẫu nhiên</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label htmlFor="angled-pose-select" className="block text-sm font-medium text-gray-300 mb-2">Tư thế (Bản vẽ phối cảnh)</label>
                            <div className="relative">
                                <select
                                    id="angled-pose-select"
                                    value={angledPose}
                                    onChange={(e) => setAngledPose(e.target.value)}
                                    className="w-full appearance-none bg-gray-700 border border-gray-600 text-white py-2 px-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                >
                                    <option value="random">Ngẫu nhiên & Sống động</option>
                                    <option value="standing">Đứng</option>
                                    <option value="sitting">Ngồi</option>
                                    <option value="lying down">Nằm</option>
                                    <option value="jumping">Nhảy</option>
                                    <option value="bowing">Cúi chào</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>
                        
                        <button onClick={handleGenerateClick} disabled={isGenerateDisabled} className="w-full mb-4 py-3 px-4 font-bold text-lg rounded-md transition-all duration-300 ease-in-out bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50 shadow-lg hover:shadow-cyan-500/50 flex items-center justify-center">
                            {isLoading && <SpinnerIcon className="w-6 h-6 mr-3" />}
                            {isLoading ? 'Đang tạo...' : 'Tạo hình Nhân vật'}
                        </button>
                        
                        {error && <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-md text-sm">{error}</div>}
                        
                        {/* Output Area */}
                        <div className="mt-4 flex-grow bg-gray-900/70 rounded-xl overflow-hidden shadow-inner">
                           {isLoading && (
                                <div className="text-center text-gray-400 flex flex-col items-center justify-center h-full">
                                    <SpinnerIcon className="w-16 h-16 mx-auto text-cyan-500" />
                                    <p className="mt-4 text-lg">Đang hợp nhất các đặc điểm...</p>
                                    <p className="text-sm text-gray-500">Đang tạo chân dung và bản vẽ nhân vật. Quá trình này có thể mất một chút thời gian.</p>
                                </div>
                            )}
                            {!isLoading && !generatedAssets.portrait && (
                                <div className="text-center text-gray-500 flex items-center justify-center h-full">
                                    <p className="text-xl">Kết quả sẽ xuất hiện ở đây</p>
                                </div>
                            )}
                            {generatedAssets.portrait && (
                                <OutputDisplay assets={generatedAssets} onImageClick={setZoomedImage} />
                            )}
                        </div>
                    </div>
                </main>
            </div>
            <ImageZoomModal imageUrl={zoomedImage} onClose={() => setZoomedImage(null)} />
        </div>
    );
};

export default App;

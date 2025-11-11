import React, { useState, useCallback } from 'react';
import { SavedFeatures, InfluenceValues } from './types';
import { generateCharacterAssets } from './services/geminiService';
import ImageInputBox from './components/ImageInputBox';
import SpinnerIcon from './components/icons/SpinnerIcon';
import ImageZoomModal from './components/ImageZoomModal';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const FeatureCheckbox: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center space-x-3 cursor-pointer text-gray-300 hover:text-white">
        <input type="checkbox" checked={checked} onChange={onChange} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600 rounded" />
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
    
    const outputBoxClasses = "bg-gray-800/50 rounded-xl p-4 flex flex-col items-center shadow-lg cursor-pointer group transition-all duration-300 hover:bg-gray-800 hover:ring-2 hover:ring-cyan-500/80";
    const imageClasses = "w-full h-auto object-contain rounded-lg transition-transform duration-300 group-hover:scale-105";
    const titleClasses = "text-xl font-bold text-cyan-400 mb-3 w-full text-center";

    return (
        <div className="w-full h-full p-4 animate-[fadeIn_0.5s_ease-in-out] overflow-y-auto">
            <div className="flex flex-col gap-8">
                
                {/* Main Portrait */}
                <div 
                    className={outputBoxClasses}
                    onClick={() => onImageClick(assets.portrait!)}
                >
                    <h3 className={titleClasses}>Character Portrait</h3>
                    <div className="w-full max-w-md">
                        <img 
                            src={assets.portrait} 
                            alt="Generated Portrait" 
                            className={imageClasses}
                        />
                    </div>
                </div>

                {/* Ortho Sheet */}
                <div 
                    className={outputBoxClasses}
                    onClick={() => onImageClick(assets.orthoSheet!)}
                >
                    <h3 className={titleClasses}>Orthographic Views</h3>
                     <div className="w-full">
                        <img 
                            src={assets.orthoSheet} 
                            alt="Orthographic Views" 
                            className={imageClasses} 
                        />
                    </div>
                </div>
                
                {/* Angled Sheet */}
                 <div 
                    className={outputBoxClasses}
                    onClick={() => onImageClick(assets.angledSheet!)}
                >
                    <h3 className={titleClasses}>Angled Views</h3>
                     <div className="w-full">
                        <img 
                            src={assets.angledSheet} 
                            alt="Angled Views" 
                            className={imageClasses}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    const [characterImage, setCharacterImage] = useState<string | null>(null);
    const [styleImage, setStyleImage] = useState<string | null>(null);

    const [savedFeatures, setSavedFeatures] = useState<SavedFeatures>({
        facialExpressions: true,
        clothes: true,
        bodyShape: true,
    });

    const [influences, setInfluences] = useState<InfluenceValues>({
        character: 100,
        style: 100,
    });

    const [orthoPose, setOrthoPose] = useState<string>('standing');
    const [angledPose, setAngledPose] = useState<string>('random');
    
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

    const handleFeatureChange = (feature: keyof SavedFeatures) => {
        setSavedFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
    };

    const handleInfluenceChange = (type: keyof InfluenceValues, value: number) => {
        setInfluences(prev => ({ ...prev, [type]: value }));
    };

    const handleGenerateClick = useCallback(async () => {
        if (!characterImage || !styleImage) {
            setError("Please upload all reference images.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedAssets({ portrait: null, orthoSheet: null, angledSheet: null });

        try {
            const result = await generateCharacterAssets(characterImage, styleImage, savedFeatures, influences, orthoPose, angledPose);
            setGeneratedAssets(result);
        } catch (err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [characterImage, styleImage, savedFeatures, influences, orthoPose, angledPose]);

    const isGenerateDisabled = !characterImage || !styleImage || isLoading;

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
                            Comic Character Fusion
                        </span>
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">Design your hero. Define their style. AI-powered character creation.</p>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* INPUTS PANEL */}
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                        <ImageInputBox title="Character Base" step={1} imagePreviewUrl={characterImage} onImageChange={handleImageChange(setCharacterImage)}>
                            <div className="space-y-3">
                                <p className="text-sm font-semibold text-gray-400">Features to keep:</p>
                                <div className="flex flex-col sm:flex-row sm:space-x-6 space-y-2 sm:space-y-0">
                                    <FeatureCheckbox label="Facial Expressions" checked={savedFeatures.facialExpressions} onChange={() => handleFeatureChange('facialExpressions')} />
                                    <FeatureCheckbox label="Clothes" checked={savedFeatures.clothes} onChange={() => handleFeatureChange('clothes')} />
                                    <FeatureCheckbox label="Body Shape" checked={savedFeatures.bodyShape} onChange={() => handleFeatureChange('bodyShape')} />
                                </div>
                            </div>
                             <div className="mt-4 pt-4 border-t border-gray-700">
                                <label htmlFor="characterInfluence" className="text-sm font-semibold text-gray-400 block mb-2">Character Influence: <span className="font-mono bg-gray-700 px-2 py-1 rounded">{influences.character}%</span></label>
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
                        <ImageInputBox title="Drawing Style" step={2} imagePreviewUrl={styleImage} onImageChange={handleImageChange(setStyleImage)}>
                            <div className="mt-0">
                                <label htmlFor="styleInfluence" className="text-sm font-semibold text-gray-400 block mb-2">Style Influence: <span className="font-mono bg-gray-700 px-2 py-1 rounded">{influences.style}%</span></label>
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
                        <h2 className="text-2xl font-bold text-cyan-400 mb-4">Controls & Output</h2>

                        <div className="mb-4">
                            <label htmlFor="pose-select" className="block text-sm font-medium text-gray-300 mb-2">Orthographic Sheet Pose</label>
                            <div className="relative">
                                <select
                                    id="pose-select"
                                    value={orthoPose}
                                    onChange={(e) => setOrthoPose(e.target.value)}
                                    className="w-full appearance-none bg-gray-700 border border-gray-600 text-white py-2 px-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                >
                                    <option value="standing">Standing (A-Pose)</option>
                                    <option value="sitting">Sitting</option>
                                    <option value="lying down">Lying Down</option>
                                    <option value="jumping">High Jump</option>
                                    <option value="bowing">Bowing</option>
                                    <option value="random">Random</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label htmlFor="angled-pose-select" className="block text-sm font-medium text-gray-300 mb-2">Angled Views Pose</label>
                            <div className="relative">
                                <select
                                    id="angled-pose-select"
                                    value={angledPose}
                                    onChange={(e) => setAngledPose(e.target.value)}
                                    className="w-full appearance-none bg-gray-700 border border-gray-600 text-white py-2 px-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                >
                                    <option value="random">Random Dynamic</option>
                                    <option value="standing">Standing</option>
                                    <option value="sitting">Sitting</option>
                                    <option value="lying down">Lying Down</option>
                                    <option value="jumping">Jumping</option>
                                    <option value="bowing">Bowing</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>
                        
                        <button onClick={handleGenerateClick} disabled={isGenerateDisabled} className="w-full mb-4 py-3 px-4 font-bold text-lg rounded-md transition-all duration-300 ease-in-out bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50 shadow-lg hover:shadow-cyan-500/50 flex items-center justify-center">
                            {isLoading && <SpinnerIcon className="w-6 h-6 mr-3" />}
                            {isLoading ? 'Generating...' : 'Generate Character Assets'}
                        </button>
                        
                        {error && <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-md text-sm">{error}</div>}
                        
                        {/* Output Area */}
                        <div className="mt-4 flex-grow bg-gray-900/70 rounded-xl overflow-hidden shadow-inner">
                           {isLoading && (
                                <div className="text-center text-gray-400 flex flex-col items-center justify-center h-full">
                                    <SpinnerIcon className="w-16 h-16 mx-auto text-cyan-500" />
                                    <p className="mt-4 text-lg">Fusing character features...</p>
                                    <p className="text-sm text-gray-500">Generating portrait and character sheets. This may take a moment.</p>
                                </div>
                            )}
                            {!isLoading && !generatedAssets.portrait && (
                                <div className="text-center text-gray-500 flex items-center justify-center h-full">
                                    <p className="text-xl">Your character assets will appear here</p>
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
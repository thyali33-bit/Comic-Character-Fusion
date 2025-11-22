
import React, { useState, useCallback, useEffect } from 'react';
import { Accessories, InfluenceValues, GenerationParams, Preset } from './types';
import { 
    generateCharacterAssets, 
    generateVariationAssets,
    generatePortrait,
    generateOrthoSheet,
    generateAngledSheet,
    generateTurntableViews
} from './services/geminiService';
import ImageInputBox from './components/ImageInputBox';
import SpinnerIcon from './components/icons/SpinnerIcon';
import ImageZoomModal from './components/ImageZoomModal';
import DownloadIcon from './components/icons/DownloadIcon';
import ResetIcon from './components/icons/ResetIcon';
import ShareIcon from './components/icons/ShareIcon';
import RegenIcon from './components/icons/RegenIcon';
import SaveIcon from './components/icons/SaveIcon';
import TrashIcon from './components/icons/TrashIcon';
import TurntableGallery from './components/TurntableGallery';
import { useLanguage } from './contexts/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';

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

const ColorPicker: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
    <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-300 mb-2">{label}</label>
        <div className="flex items-center bg-gray-700 p-2 rounded-md border border-gray-600">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
            />
            <span className="ml-2 text-sm text-gray-400 uppercase font-mono">{value}</span>
        </div>
    </div>
);

const App: React.FC = () => {
    const { t } = useLanguage();

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

    const [enableColorOverride, setEnableColorOverride] = useState(false);
    const [primaryColor, setPrimaryColor] = useState('#3b82f6'); // Default Blue
    const [secondaryColor, setSecondaryColor] = useState('#f59e0b'); // Default Amber
    
    const [orthoPose, setOrthoPose] = useState('standing');
    const [angledPose, setAngledPose] = useState('random');
    const [facialExpression, setFacialExpression] = useState('neutral');
    const [facialExpressionIntensity, setFacialExpressionIntensity] = useState(50);
    const [quality, setQuality] = useState('standard');
    const [prompt, setPrompt] = useState('');
    const [threeDActionPrompt, setThreeDActionPrompt] = useState('');
    
    const [generatedPortrait, setGeneratedPortrait] = useState<string | null>(null);
    const [generatedOrthoSheet, setGeneratedOrthoSheet] = useState<string | null>(null);
    const [generatedAngledSheet, setGeneratedAngledSheet] = useState<string | null>(null);
    const [generatedTurntableSheet, setGeneratedTurntableSheet] = useState<string | null>(null);
    
    const [generatingStates, setGeneratingStates] = useState({
        main: false,
        variation: false,
        portrait: false,
        ortho: false,
        angled: false,
        turntable: false,
    });
    const isAnyLoading = Object.values(generatingStates).some(s => s);

    const [error, setError] = useState<string | null>(null);
    
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    const [lastGenerationParams, setLastGenerationParams] = useState<GenerationParams | null>(null);
    const [variationStrength, setVariationStrength] = useState(30);

    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Presets State
    const [presets, setPresets] = useState<Preset[]>([]);
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => {
                setToastMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // Load presets from local storage on mount
    useEffect(() => {
        const storedPresets = localStorage.getItem('characterPresets');
        if (storedPresets) {
            try {
                setPresets(JSON.parse(storedPresets));
            } catch (e) {
                console.error("Failed to parse presets", e);
            }
        }
    }, []);
    
    const showToast = (message: string) => {
        setToastMessage(message);
    };

    const handleImageChange = (setter: React.Dispatch<React.SetStateAction<string | null>>) => async (file: File) => {
        try {
            const base64 = await fileToBase64(file);
            setter(base64);
        } catch (error) {
            console.error("Error converting file to base64:", error);
            setError(t.fileProcessingError);
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
        setEnableColorOverride(false);
        setPrimaryColor('#3b82f6');
        setSecondaryColor('#f59e0b');
        setOrthoPose('standing');
        setAngledPose('random');
        setFacialExpression('neutral');
        setFacialExpressionIntensity(50);
        setQuality('standard');
        setPrompt('');
        setThreeDActionPrompt('');
        setGeneratedPortrait(null);
        setGeneratedOrthoSheet(null);
        setGeneratedAngledSheet(null);
        setGeneratedTurntableSheet(null);
        setError(null);
        setLastGenerationParams(null);
        setVariationStrength(30);
    };
    
    const getCurrentParams = useCallback((): GenerationParams => ({
        faceImage, styleImage, clothingImage, accessories, influences, orthoPose,
        angledPose, facialExpression, facialExpressionIntensity, prompt, quality,
        threeDActionPrompt, primaryColor, secondaryColor, enableColorOverride
    }), [faceImage, styleImage, clothingImage, accessories, influences, orthoPose, angledPose, facialExpression, facialExpressionIntensity, prompt, quality, threeDActionPrompt, primaryColor, secondaryColor, enableColorOverride]);

    // Preset Handlers
    const handleSavePreset = () => {
        if (!newPresetName.trim()) return;

        const currentConfig = getCurrentParams();
        // Remove image data to save space and because presets are about settings
        const { faceImage, styleImage, clothingImage, ...configOnly } = currentConfig;
        
        const newPreset: Preset = {
            id: Date.now().toString(),
            name: newPresetName,
            timestamp: Date.now(),
            config: configOnly
        };

        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        localStorage.setItem('characterPresets', JSON.stringify(updatedPresets));
        
        setNewPresetName('');
        setIsSavingPreset(false);
        showToast(t.presetSaved);
    };

    const handleLoadPreset = (preset: Preset) => {
        const { config } = preset;
        setAccessories(config.accessories);
        setInfluences(config.influences);
        setOrthoPose(config.orthoPose);
        setAngledPose(config.angledPose);
        setFacialExpression(config.facialExpression);
        setFacialExpressionIntensity(config.facialExpressionIntensity);
        setPrompt(config.prompt);
        setQuality(config.quality);
        setThreeDActionPrompt(config.threeDActionPrompt);
        setPrimaryColor(config.primaryColor);
        setSecondaryColor(config.secondaryColor);
        setEnableColorOverride(config.enableColorOverride ?? false);
        showToast(t.presetLoaded);
    };

    const handleDeletePreset = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedPresets = presets.filter(p => p.id !== id);
        setPresets(updatedPresets);
        localStorage.setItem('characterPresets', JSON.stringify(updatedPresets));
    };


    const handleGenerate = useCallback(async () => {
        setGeneratingStates(s => ({ ...s, main: true }));
        setError(null);

        const params = getCurrentParams();
        setLastGenerationParams(params);

        try {
            const { portrait, orthoSheet, angledSheet, turntableSheet } = await generateCharacterAssets(params);
            setGeneratedPortrait(portrait);
            setGeneratedOrthoSheet(orthoSheet);
            setGeneratedAngledSheet(angledSheet);
            setGeneratedTurntableSheet(turntableSheet);
        } catch (err: any) {
            setError(err.message || t.unknownError);
        } finally {
            setGeneratingStates(s => ({ ...s, main: false }));
        }
    }, [getCurrentParams, t]);
    
    const handleRegeneratePortrait = useCallback(async () => {
        setGeneratingStates(s => ({ ...s, portrait: true }));
        setError(null);
        const params = getCurrentParams();
        setLastGenerationParams(params);

        try {
            // Re-generating the portrait means we need to regenerate everything that depends on it
            const { portrait, orthoSheet, angledSheet, turntableSheet } = await generateCharacterAssets(params);
            setGeneratedPortrait(portrait);
            setGeneratedOrthoSheet(orthoSheet);
            setGeneratedAngledSheet(angledSheet);
            setGeneratedTurntableSheet(turntableSheet);
        } catch (err: any) {
            setError(err.message || t.unknownError);
        } finally {
            setGeneratingStates(s => ({ ...s, portrait: false }));
        }
    }, [getCurrentParams, t]);

    const handleRegenerateOrtho = useCallback(async () => {
        if (!generatedPortrait) return;
        setGeneratingStates(s => ({ ...s, ortho: true }));
        setError(null);
        const params = getCurrentParams();
        setLastGenerationParams(params);
        try {
            const orthoSheet = await generateOrthoSheet(generatedPortrait, params);
            setGeneratedOrthoSheet(orthoSheet);
        } catch (err: any) {
            setError(err.message || t.unknownError);
        } finally {
            setGeneratingStates(s => ({ ...s, ortho: false }));
        }
    }, [generatedPortrait, getCurrentParams, t]);

    const handleRegenerateAngled = useCallback(async () => {
        if (!generatedPortrait) return;
        setGeneratingStates(s => ({ ...s, angled: true }));
        setError(null);
        const params = getCurrentParams();
        setLastGenerationParams(params);
        try {
            const angledSheet = await generateAngledSheet(generatedPortrait, params);
            setGeneratedAngledSheet(angledSheet);
        } catch (err: any) {
            setError(err.message || t.unknownError);
        } finally {
            setGeneratingStates(s => ({ ...s, angled: false }));
        }
    }, [generatedPortrait, getCurrentParams, t]);

    const handleRegenerateTurntable = useCallback(async () => {
        if (!generatedPortrait) return;
        setGeneratingStates(s => ({ ...s, turntable: true }));
        setError(null);
        const params = getCurrentParams();
        setLastGenerationParams(params);
        try {
            const turntableSheet = await generateTurntableViews(generatedPortrait, params);
            setGeneratedTurntableSheet(turntableSheet);
        } catch (err: any) {
            setError(err.message || t.unknownError);
        } finally {
            setGeneratingStates(s => ({ ...s, turntable: false }));
        }
    }, [generatedPortrait, getCurrentParams, t]);

    const handleGenerateVariation = useCallback(async () => {
        if (!generatedPortrait || !lastGenerationParams) return;

        setGeneratingStates(s => ({ ...s, variation: true }));
        setError(null);
        
        try {
            const { portrait, orthoSheet, angledSheet, turntableSheet } = await generateVariationAssets(
                generatedPortrait,
                variationStrength,
                lastGenerationParams
            );
            setGeneratedPortrait(portrait);
            setGeneratedOrthoSheet(orthoSheet);
            setGeneratedAngledSheet(angledSheet);
            setGeneratedTurntableSheet(turntableSheet);

        } catch (err: any)
        {
            setError(err.message || t.variationError);
        } finally {
            setGeneratingStates(s => ({ ...s, variation: false }));
        }
    }, [generatedPortrait, lastGenerationParams, variationStrength, t]);
    
    const downloadImage = (imageUrl: string | null, filename: string) => {
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async (imageUrl: string | null) => {
        if (!imageUrl) return;

        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], 'comic-character.png', { type: blob.type });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Comic Character Fusion',
                    text: t.shareText,
                    files: [file],
                });
                return; // Exit if share is successful
            }
        } catch (error) {
            if ((error as DOMException).name !== 'AbortError') {
                 console.warn('Web Share API failed, falling back to clipboard.', error);
            } else {
                return; // User cancelled share, do nothing.
            }
        }

        // Fallback to clipboard
        try {
            await navigator.clipboard.writeText(imageUrl);
            showToast(t.shareFallback);
        } catch (err) {
            console.error('Failed to copy image URL:', err);
            showToast(t.shareError);
        }
    };


    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 font-sans">
            <style>{`
                .range-thumb-cyan::-webkit-slider-thumb { background: var(--thumb-color); }
                .range-thumb-cyan::-moz-range-thumb { background: var(--thumb-color); }
                 @keyframes fadeInOut {
                    0%, 100% { opacity: 0; transform: translateY(20px); }
                    10%, 90% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-out {
                    animation: fadeInOut 3s ease-in-out forwards;
                }
                 @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            `}</style>
            
            <ImageZoomModal imageUrl={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />

            {toastMessage && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-[101] animate-fade-in-out">
                    {toastMessage}
                </div>
            )}

            <header className="text-center mb-8 relative">
                <div className="absolute top-0 right-0">
                    <LanguageSwitcher />
                </div>
                <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                    {t.appTitle}
                </h1>
                <p className="mt-2 text-gray-400 max-w-2xl mx-auto">
                    {t.appDescription}
                </p>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700">
                    <h2 className="text-2xl font-semibold mb-6 text-teal-400 border-b-2 border-gray-700 pb-2">{t.controlPanel}</h2>
                    
                    {/* Presets Section */}
                     <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6 border border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-cyan-400">{t.presetsTitle}</h3>
                            <button 
                                onClick={() => setIsSavingPreset(!isSavingPreset)}
                                className="text-sm bg-teal-600 hover:bg-teal-500 text-white px-3 py-1 rounded flex items-center gap-1"
                            >
                                <SaveIcon className="w-4 h-4" />
                                {t.savePreset}
                            </button>
                        </div>

                        {isSavingPreset && (
                            <div className="flex gap-2 mb-4 animate-fade-in">
                                <input 
                                    type="text" 
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    placeholder={t.presetNamePlaceholder}
                                    className="flex-grow bg-gray-700 border-gray-600 rounded-md px-3 py-1 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                                />
                                <button 
                                    onClick={handleSavePreset}
                                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded-md text-sm font-medium"
                                >
                                    {t.save}
                                </button>
                                <button 
                                    onClick={() => { setIsSavingPreset(false); setNewPresetName(''); }}
                                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm"
                                >
                                    {t.cancel}
                                </button>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {presets.length === 0 ? (
                                <p className="text-gray-500 text-sm italic">{t.noPresets}</p>
                            ) : (
                                presets.map(preset => (
                                    <div key={preset.id} className="group flex items-center bg-gray-700 border border-gray-600 rounded-full px-3 py-1 hover:bg-gray-600 transition-colors">
                                        <button 
                                            onClick={() => handleLoadPreset(preset)}
                                            className="text-sm text-gray-200 mr-2 truncate max-w-[150px] hover:text-white"
                                            title={t.loadPreset}
                                        >
                                            {preset.name}
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeletePreset(preset.id, e)}
                                            className="text-gray-500 hover:text-red-400 p-0.5 rounded-full"
                                            title={t.deletePreset}
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <ImageInputBox title={t.faceTitle} step={1} imagePreviewUrl={faceImage} onImageChange={handleImageChange(setFaceImage)} onRemove={() => setFaceImage(null)} />
                        <ImageInputBox title={t.clothingTitle} step={2} imagePreviewUrl={clothingImage} onImageChange={handleImageChange(setClothingImage)} onRemove={() => setClothingImage(null)}>
                           {clothingImage && (
                                <div className="space-y-2 mt-3 p-3 bg-gray-900/50 rounded-md">
                                    <h4 className="text-sm font-semibold text-cyan-400">{t.accessoriesTitle}</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <FeatureCheckbox label={t.bracelets} checked={accessories.bracelets} onChange={() => handleAccessoryChange('bracelets')} />
                                        <FeatureCheckbox label={t.necklaces} checked={accessories.necklaces} onChange={() => handleAccessoryChange('necklaces')} />
                                        <FeatureCheckbox label={t.earrings} checked={accessories.earrings} onChange={() => handleAccessoryChange('earrings')} />
                                        <FeatureCheckbox label={t.eyeglasses} checked={accessories.eyeglasses} onChange={() => handleAccessoryChange('eyeglasses')} />
                                    </div>
                                </div>
                            )}
                        </ImageInputBox>
                        <ImageInputBox title={t.styleTitle} step={3} imagePreviewUrl={styleImage} onImageChange={handleImageChange(setStyleImage)} onRemove={() => setStyleImage(null)} />
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6">
                        <h3 className="text-lg font-bold text-cyan-400 mb-4">{t.influenceTitle}</h3>
                        <InfluenceSlider label={t.characterInfluence} value={influences.character} onChange={handleInfluenceChange('character')} />
                        <InfluenceSlider label={t.clothingInfluence} value={influences.clothing} onChange={handleInfluenceChange('clothing')} />
                        <InfluenceSlider label={t.styleInfluence} value={influences.style} onChange={handleInfluenceChange('style')} />
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-cyan-400">{t.colorPaletteTitle}</h3>
                            <FeatureCheckbox 
                                label={t.enableColorOverride} 
                                checked={enableColorOverride} 
                                onChange={() => setEnableColorOverride(!enableColorOverride)} 
                            />
                        </div>
                        
                        {enableColorOverride && (
                            <div className="grid grid-cols-2 gap-6 animate-fade-in">
                                <ColorPicker label={t.primaryColor} value={primaryColor} onChange={setPrimaryColor} />
                                <ColorPicker label={t.secondaryColor} value={secondaryColor} onChange={setSecondaryColor} />
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6">
                        <h3 className="text-lg font-bold text-cyan-400 mb-4">{t.generationOptions}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="quality" className="block text-sm font-medium text-gray-300 mb-2">{t.quality}</label>
                                <select id="quality" value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500">
                                    <option value="standard">{t.qualityStandard}</option>
                                    <option value="hd">{t.qualityHD}</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="ortho-pose" className="block text-sm font-medium text-gray-300 mb-2">{t.orthoPose}</label>
                                <select id="ortho-pose" value={orthoPose} onChange={e => setOrthoPose(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500">
                                    <option value="standing">{t.poseStanding}</option>
                                    <option value="sitting">{t.poseSitting}</option>
                                    <option value="lying down">{t.poseLying}</option>
                                    <option value="jumping">{t.poseJumping}</option>
                                    <option value="bowing">{t.poseBowing}</option>
                                    <option value="random">{t.poseRandom}</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="angled-pose" className="block text-sm font-medium text-gray-300 mb-2">{t.angledPose}</label>
                                <select id="angled-pose" value={angledPose} onChange={e => setAngledPose(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500">
                                    <option value="random">{t.poseRandom}</option>
                                    <option value="standing">{t.poseStanding}</option>
                                    <option value="sitting">{t.poseSitting}</option>
                                    <option value="lying down">{t.poseLying}</option>
                                    <option value="jumping">{t.poseJumping}</option>
                                    <option value="bowing">{t.poseBowing}</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="facial-expression" className="block text-sm font-medium text-gray-300 mb-2">{t.facialExpression}</label>
                                <select id="facial-expression" value={facialExpression} onChange={e => setFacialExpression(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500" disabled={!faceImage && facialExpression === 'from_face_reference'}>
                                    <option value="neutral">{t.expressionNeutral}</option>
                                    <option value="from_face_reference" disabled={!faceImage}>{t.expressionFromReference}</option>
                                    <option value="happy">{t.expressionHappy}</option>
                                    <option value="sad">{t.expressionSad}</option>
                                    <option value="angry">{t.expressionAngry}</option>
                                    <option value="surprised">{t.expressionSurprised}</option>
                                    <option value="determined">{t.expressionDetermined}</option>
                                    <option value="smirking">{t.expressionSmirking}</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">{t.characterDescription}</label>
                            <textarea
                                id="prompt"
                                rows={2}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder={t.characterDescriptionPlaceholder}
                                className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-sm"
                            />
                        </div>

                        <div className="mt-4">
                            <label htmlFor="3d-action-prompt" className="block text-sm font-medium text-gray-300 mb-2">{t.threeDActionPromptLabel}</label>
                            <textarea
                                id="3d-action-prompt"
                                rows={2}
                                value={threeDActionPrompt}
                                onChange={e => setThreeDActionPrompt(e.target.value)}
                                placeholder={t.threeDActionPromptPlaceholder}
                                className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-sm"
                            />
                        </div>

                         {facialExpression !== 'neutral' && facialExpression !== 'from_face_reference' && (
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t.expressionIntensity}: {facialExpressionIntensity}%</label>
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

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleGenerate}
                            disabled={isAnyLoading}
                            className="flex-grow bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center"
                        >
                            {generatingStates.main ? (
                                <>
                                    <SpinnerIcon className="w-5 h-5 mr-3" />
                                    {t.generating}...
                                </>
                            ) : (
                                t.generateButton
                            )}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={isAnyLoading}
                            className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            aria-label={t.resetTooltip}
                        >
                            <ResetIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                </div>

                <div className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700 flex flex-col items-center justify-center min-h-[60vh]">
                    {!generatedPortrait && !isAnyLoading && (
                        <div className="text-center text-gray-500">
                            <svg className="w-24 h-24 mx-auto text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <h3 className="mt-4 text-xl font-semibold">{t.resultsTitle}</h3>
                            <p className="mt-1 text-gray-400">{t.resultsDescription}</p>
                        </div>
                    )}
                    {generatingStates.main && !generatedPortrait && (
                         <div className="text-center text-gray-400">
                            <SpinnerIcon className="w-16 h-16 mx-auto mb-4 text-cyan-500" />
                            <p className="text-lg animate-pulse">{t.loadingMessage}</p>
                            <p className="text-sm mt-2">{t.loadingDescription}</p>
                        </div>
                    )}
                    {generatedPortrait && (
                        <div className="w-full space-y-6">
                           <h2 className="text-2xl font-semibold text-teal-400 border-b-2 border-gray-700 pb-2 text-center">{t.resultsGeneratedTitle}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <GeneratedImage title={t.portrait} imageUrl={generatedPortrait} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedPortrait, 'portrait.png')} onShare={() => handleShare(generatedPortrait)} onReGenerate={handleRegeneratePortrait} isLoading={generatingStates.main || generatingStates.variation || generatingStates.portrait} />
                                <GeneratedImage title={t.orthoSheet} imageUrl={generatedOrthoSheet} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedOrthoSheet, 'ortho-sheet.png')} onShare={() => handleShare(generatedOrthoSheet)} onReGenerate={handleRegenerateOrtho} isLoading={generatingStates.main || generatingStates.variation || generatingStates.ortho} />
                                <GeneratedImage title={t.angledSheet} imageUrl={generatedAngledSheet} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedAngledSheet, 'angled-sheet.png')} onShare={() => handleShare(generatedAngledSheet)} onReGenerate={handleRegenerateAngled} isLoading={generatingStates.main || generatingStates.variation || generatingStates.angled} />
                            </div>

                            <div className="md:col-span-2 lg:col-span-3">
                                {generatedTurntableSheet && (
                                     <TurntableGallery
                                        title={t.threeDViews}
                                        sheetUrl={generatedTurntableSheet}
                                        onZoom={setZoomedImageUrl}
                                        onShare={handleShare}
                                        onReGenerate={handleRegenerateTurntable}
                                        isGenerating={generatingStates.main || generatingStates.variation || generatingStates.turntable}
                                    />
                                )}
                            </div>

                             <div className="bg-gray-800 p-4 rounded-lg shadow-inner mt-6">
                                <h3 className="text-lg font-bold text-cyan-400 mb-4">{t.variationTitle}</h3>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">{t.variationStrength}: {variationStrength}%</label>
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
                                    disabled={isAnyLoading}
                                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center"
                                >
                                    {generatingStates.variation ? (
                                        <>
                                            <SpinnerIcon className="w-5 h-5 mr-3" />
                                            {t.varying}...
                                        </>
                                    ) : (
                                        t.variationButton
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
    onShare: () => void;
    onReGenerate?: () => void;
    isLoading: boolean;
}

const GeneratedImage: React.FC<GeneratedImageProps> = ({ title, imageUrl, onZoom, onDownload, onShare, onReGenerate, isLoading }) => {
    const { t } = useLanguage();
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
                            <div className="flex space-x-2">
                                <button onClick={() => onZoom(imageUrl)} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label={t.zoom}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                </button>
                                {onReGenerate && (
                                    <button onClick={onReGenerate} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label={t.regenerateTooltip}>
                                        <RegenIcon className="w-5 h-5" />
                                    </button>
                                )}
                                <button onClick={onShare} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label={t.share}>
                                    <ShareIcon className="w-5 h-5" />
                                </button>
                                <button onClick={onDownload} className="text-white hover:text-cyan-400 transition-colors p-2 bg-black/50 rounded-full" aria-label={t.download}>
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
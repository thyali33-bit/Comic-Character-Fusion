
import React, { useState, useCallback, useEffect } from 'react';
import { Accessories, InfluenceValues, GenerationParams, BackgroundType, ExpressionIntensity, OrthoViews } from './types';
import { 
    generateCharacterAssets, 
    generatePortrait,
    generateOrthoView,
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
import ChevronDownIcon from './components/icons/ChevronDownIcon';
import ChevronUpIcon from './components/icons/ChevronUpIcon';
import TurntableGallery from './components/TurntableGallery';
import { useLanguage } from './contexts/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import UploadIcon from './components/icons/UploadIcon';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const FeatureCheckbox: React.FC<{ label: string; checked: boolean; onChange: () => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
    <label className={`flex items-center space-x-3 text-gray-300 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-white'} transition-colors`}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600 rounded" />
        <span>{label}</span>
    </label>
);

const ColorPicker: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
    <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-300 mb-2">{label}</label>
        <div className="flex items-center bg-gray-700 p-2 rounded-md border border-gray-600 hover:border-cyan-500 transition-colors">
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

const ART_STYLES = [
    { id: 'ghibli', labelKey: 'styleGhibli' },
    { id: 'one_piece', labelKey: 'styleOnePiece' },
    { id: 'doraemon', labelKey: 'styleDoraemon' },
    { id: 'chibi', labelKey: 'styleChibi' },
    { id: 'dragon_ball', labelKey: 'styleDragonBall' },
    { id: 'comic', labelKey: 'styleComic' },
    { id: 'ukiyoe', labelKey: 'styleUkiyoe' },
    { id: 'renaissance', labelKey: 'styleRenaissance' },
    { id: 'pixel', labelKey: 'stylePixel' },
    { id: 'cyberpunk', labelKey: 'styleCyberpunk' },
    { id: 'watercolor', labelKey: 'styleWatercolor' },
    { id: 'disney_3d', labelKey: 'styleDisney3D' },
];

const App: React.FC = () => {
    const { t } = useLanguage();

    const [faceImage, setFaceImage] = useState<string | null>(null);
    const [clothingImage, setClothingImage] = useState<string | null>(null);
    
    // New State for Style and Color Mode
    const [artStyle, setArtStyle] = useState('ghibli');
    const [artStylePrompt, setArtStylePrompt] = useState(''); // New prompt state
    const [isBlackAndWhite, setIsBlackAndWhite] = useState(false);

    const [accessories, setAccessories] = useState<Accessories>({
        bracelets: false,
        necklaces: false,
        earrings: false,
        eyeglasses: false,
    });
    
    // Influences removed as per new strict prompt logic
    const [influences, setInfluences] = useState<InfluenceValues>({
        character: 70,
        clothing: 70,
        style: 70,
    });

    const [enableColorOverride, setEnableColorOverride] = useState(false);
    const [primaryColor, setPrimaryColor] = useState('#3b82f6'); // Default Blue
    const [secondaryColor, setSecondaryColor] = useState('#f59e0b'); // Default Amber

    // Background State
    const [backgroundType, setBackgroundType] = useState<BackgroundType>('simple');
    const [backgroundColor, setBackgroundColor] = useState('#374151'); // Gray-700 default
    const [backgroundPrompt, setBackgroundPrompt] = useState('');
    
    const [orthoPose, setOrthoPose] = useState('standing');
    const [angledPose, setAngledPose] = useState('random');
    const [facialExpression, setFacialExpression] = useState('from_reference');
    const [facialExpressionIntensity, setFacialExpressionIntensity] = useState<ExpressionIntensity>('medium');
    const [quality, setQuality] = useState('standard');
    const [prompt, setPrompt] = useState('');
    const [threeDActionPrompt, setThreeDActionPrompt] = useState('');
    
    const [generatedPortrait, setGeneratedPortrait] = useState<string | null>(null);
    
    // State update for Ortho Views (Split)
    const [generatedOrthoViews, setGeneratedOrthoViews] = useState<OrthoViews>({ front: null, side: null, back: null });
    
    const [generatedAngledSheet, setGeneratedAngledSheet] = useState<string | null>(null);
    const [generatedTurntableSheet, setGeneratedTurntableSheet] = useState<string | null>(null);
    
    const [generatingStates, setGeneratingStates] = useState({
        main: false,
        portrait: false,
        orthoFront: false,
        orthoSide: false,
        orthoBack: false,
        angled: false,
        turntable: false,
    });
    const isAnyLoading = Object.values(generatingStates).some(s => s);

    const [error, setError] = useState<string | null>(null);
    
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const [lastGenerationParams, setLastGenerationParams] = useState<GenerationParams | null>(null);

    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => {
                setToastMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

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

    const handleReset = () => {
        setFaceImage(null);
        setClothingImage(null);
        setArtStyle('ghibli');
        setArtStylePrompt('');
        setIsBlackAndWhite(false);
        setAccessories({
            bracelets: false,
            necklaces: false,
            earrings: false,
            eyeglasses: false,
        });
        setEnableColorOverride(false);
        setPrimaryColor('#3b82f6');
        setSecondaryColor('#f59e0b');
        setBackgroundType('simple');
        setBackgroundColor('#374151');
        setBackgroundPrompt('');
        setOrthoPose('standing');
        setAngledPose('random');
        setFacialExpression('from_reference');
        setFacialExpressionIntensity('medium');
        setQuality('standard');
        setPrompt('');
        setThreeDActionPrompt('');
        setGeneratedPortrait(null);
        setGeneratedOrthoViews({ front: null, side: null, back: null });
        setGeneratedAngledSheet(null);
        setGeneratedTurntableSheet(null);
        setError(null);
        setLastGenerationParams(null);
        setIsAdvancedOpen(false);
    };
    
    const getCurrentParams = useCallback((): GenerationParams => ({
        faceImage, clothingImage, artStyle, artStylePrompt, isBlackAndWhite, accessories, influences, orthoPose,
        angledPose, facialExpression, facialExpressionIntensity, prompt, quality,
        threeDActionPrompt, primaryColor, secondaryColor, enableColorOverride,
        backgroundType, backgroundColor, backgroundPrompt
    }), [faceImage, clothingImage, artStyle, artStylePrompt, isBlackAndWhite, accessories, influences, orthoPose, angledPose, facialExpression, facialExpressionIntensity, prompt, quality, threeDActionPrompt, primaryColor, secondaryColor, enableColorOverride, backgroundType, backgroundColor, backgroundPrompt]);

    const handleGenerate = useCallback(async () => {
        setGeneratingStates(s => ({ ...s, main: true }));
        setError(null);

        const params = getCurrentParams();
        setLastGenerationParams(params);

        try {
            const { portrait, orthoViews, angledSheet, turntableSheet } = await generateCharacterAssets(params);
            setGeneratedPortrait(portrait);
            setGeneratedOrthoViews(orthoViews);
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
            const portrait = await generatePortrait(params);
            setGeneratedPortrait(portrait);
        } catch (err: any) {
            setError(err.message || t.unknownError);
        } finally {
            setGeneratingStates(s => ({ ...s, portrait: false }));
        }
    }, [getCurrentParams, t]);

    const handleRegenerateOrthoView = useCallback(async (viewType: 'FRONT' | 'SIDE' | 'BACK') => {
        if (!generatedPortrait) return;
        
        const stateKey = viewType === 'FRONT' ? 'orthoFront' : viewType === 'SIDE' ? 'orthoSide' : 'orthoBack';
        setGeneratingStates(s => ({ ...s, [stateKey]: true }));
        
        setError(null);
        const params = getCurrentParams();
        setLastGenerationParams(params);
        try {
            const newView = await generateOrthoView(generatedPortrait, params, viewType);
            setGeneratedOrthoViews(prev => ({
                ...prev,
                [viewType.toLowerCase()]: newView
            }));
        } catch (err: any) {
            setError(err.message || t.unknownError);
        } finally {
            setGeneratingStates(s => ({ ...s, [stateKey]: false }));
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
                return; 
            }
        } catch (error) {
            if ((error as DOMException).name !== 'AbortError') {
                 console.warn('Web Share API failed, falling back to clipboard.', error);
            } else {
                return;
            }
        }

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
                .scrollbar-thin::-webkit-scrollbar { width: 6px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #4b5563; border-radius: 20px; }
            `}</style>
            
            <ImageZoomModal imageUrl={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />

            {toastMessage && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-[101] animate-fade-in-out border border-gray-600">
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

            <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Control Panel */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-xl border border-gray-700/50">
                        <h2 className="text-2xl font-semibold mb-6 text-teal-400 flex items-center gap-2">
                           <span className="w-1.5 h-8 bg-teal-500 rounded-full"></span>
                           {t.controlPanel}
                        </h2>
                        
                        {/* Section 1: The Ingredients (Images) */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">{t.sectionIngredients}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <ImageInputBox title={t.faceTitle} step={1} imagePreviewUrl={faceImage} onImageChange={handleImageChange(setFaceImage)} onRemove={() => setFaceImage(null)} />
                                <ImageInputBox title={t.clothingTitle} step={2} imagePreviewUrl={clothingImage} onImageChange={handleImageChange(setClothingImage)} onRemove={() => setClothingImage(null)}>
                                    {clothingImage && (
                                        <div className={`mt-2 p-2 bg-black/20 rounded-md border border-gray-700/50 ${!enableColorOverride ? 'opacity-50' : 'opacity-100'}`}>
                                            <div className="grid grid-cols-2 gap-1">
                                                <FeatureCheckbox label={t.bracelets} checked={accessories.bracelets} onChange={() => handleAccessoryChange('bracelets')} disabled={!enableColorOverride} />
                                                <FeatureCheckbox label={t.necklaces} checked={accessories.necklaces} onChange={() => handleAccessoryChange('necklaces')} disabled={!enableColorOverride} />
                                                <FeatureCheckbox label={t.earrings} checked={accessories.earrings} onChange={() => handleAccessoryChange('earrings')} disabled={!enableColorOverride} />
                                                <FeatureCheckbox label={t.eyeglasses} checked={accessories.eyeglasses} onChange={() => handleAccessoryChange('eyeglasses')} disabled={!enableColorOverride} />
                                            </div>
                                        </div>
                                    )}
                                </ImageInputBox>
                            </div>
                        </div>

                        {/* Section 2: The Style */}
                        <div className="mb-8">
                             <div className="flex justify-between items-end mb-4 border-b border-gray-700 pb-2">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.styleTitle}</h3>
                                <div className="flex items-center bg-gray-900/80 rounded-lg p-1 border border-gray-700">
                                    <button 
                                        onClick={() => setIsBlackAndWhite(false)}
                                        className={`px-2 py-1 text-xs font-bold rounded transition-colors ${!isBlackAndWhite ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {t.modeColor}
                                    </button>
                                    <button 
                                        onClick={() => setIsBlackAndWhite(true)}
                                        className={`px-2 py-1 text-xs font-bold rounded transition-colors ${isBlackAndWhite ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {t.modeBW}
                                    </button>
                                </div>
                             </div>
                             
                             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto scrollbar-thin pr-1 mb-4">
                                {ART_STYLES.map((style) => (
                                    <button
                                        key={style.id}
                                        onClick={() => setArtStyle(style.id)}
                                        className={`p-3 rounded-lg text-left text-xs font-medium transition-all duration-200 border relative overflow-hidden group
                                            ${artStyle === style.id 
                                                ? 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border-cyan-500 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <span className="relative z-10">{t[style.labelKey as keyof typeof t] as string}</span>
                                        {artStyle === style.id && <div className="absolute inset-0 bg-cyan-400/10 animate-pulse"></div>}
                                    </button>
                                ))}
                            </div>

                            {/* New Art Style Prompt Input */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">{t.artStylePromptLabel}</label>
                                <textarea
                                    value={artStylePrompt}
                                    onChange={(e) => setArtStylePrompt(e.target.value)}
                                    placeholder={t.artStylePromptPlaceholder}
                                    className="w-full bg-gray-700 border-gray-600 rounded-md text-sm shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-white placeholder-gray-500"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {/* Section 3: Customization (Colors & Background) */}
                         <div className="mb-6 space-y-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 pb-2">{t.sectionCustomization}</h3>
                            
                            {/* Color Overrides */}
                             <div className="bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-medium text-gray-300">{t.colorPaletteTitle}</h4>
                                    <FeatureCheckbox 
                                        label={t.enableColorOverride} 
                                        checked={enableColorOverride} 
                                        onChange={() => setEnableColorOverride(!enableColorOverride)} 
                                    />
                                </div>
                                {enableColorOverride && (
                                    <div className="grid grid-cols-2 gap-4 animate-fade-in mt-3">
                                        <ColorPicker label={t.primaryColor} value={primaryColor} onChange={setPrimaryColor} />
                                        <ColorPicker label={t.secondaryColor} value={secondaryColor} onChange={setSecondaryColor} />
                                    </div>
                                )}
                            </div>

                            {/* Background Settings */}
                             <div className="bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                                <label className="block text-sm font-medium text-gray-300 mb-2">{t.backgroundSettings}</label>
                                <div className="flex gap-2 mb-3">
                                    <select 
                                        value={backgroundType} 
                                        onChange={(e) => setBackgroundType(e.target.value as BackgroundType)}
                                        className="flex-grow bg-gray-700 border-gray-600 rounded-md text-sm shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                                    >
                                        <option value="simple">{t.bgSimple}</option>
                                        <option value="solid">{t.bgSolid}</option>
                                        <option value="scene">{t.bgScene}</option>
                                    </select>
                                    {backgroundType === 'solid' && (
                                        <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-transparent border-none p-0" />
                                    )}
                                </div>
                                {backgroundType === 'scene' && (
                                    <textarea
                                        rows={2}
                                        value={backgroundPrompt}
                                        onChange={(e) => setBackgroundPrompt(e.target.value)}
                                        placeholder={t.bgScenePlaceholder}
                                        className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-sm"
                                    />
                                )}
                             </div>
                         </div>

                        {/* Section 4: Collapsible Advanced Settings */}
                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                            <button 
                                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                className="w-full flex justify-between items-center p-3 bg-gray-800 hover:bg-gray-750 transition-colors text-left"
                            >
                                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.advancedSettings}</span>
                                {isAdvancedOpen ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
                            </button>
                            
                            {isAdvancedOpen && (
                                <div className="p-4 bg-gray-900/30 space-y-4 animate-fade-in">
                                     <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">{t.quality}</label>
                                            <select value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md text-sm">
                                                <option value="standard">{t.qualityStandard}</option>
                                                <option value="hd">{t.qualityHD}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">{t.orthoPose}</label>
                                            <select value={orthoPose} onChange={e => setOrthoPose(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md text-sm">
                                                <option value="standing">{t.poseStanding}</option>
                                                <option value="T-pose">T-Pose</option>
                                                <option value="A-pose">A-Pose</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">{t.facialExpression}</label>
                                            <select value={facialExpression} onChange={e => setFacialExpression(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md text-sm">
                                                <option value="from_reference">{t.expressionFromReference}</option>
                                                <option value="happy">{t.expressionHappy}</option>
                                                <option value="sad">{t.expressionSad}</option>
                                                <option value="angry">{t.expressionAngry}</option>
                                                <option value="surprised">{t.expressionSurprised}</option>
                                                <option value="emotionless">{t.expressionEmotionless}</option>
                                                <option value="neutral">{t.expressionNeutral}</option>
                                                <option value="determined">{t.expressionDetermined}</option>
                                                <option value="smirking">{t.expressionSmirking}</option>
                                            </select>
                                        </div>
                                        <div>
                                             <label className="block text-xs text-gray-500 mb-1">{t.expressionIntensity}</label>
                                             <div className="flex rounded-md bg-gray-700 p-1">
                                                {['low', 'medium', 'high'].map((level) => (
                                                    <button
                                                        key={level}
                                                        onClick={() => setFacialExpressionIntensity(level as ExpressionIntensity)}
                                                        className={`flex-1 text-xs py-1.5 rounded transition-all ${
                                                            facialExpressionIntensity === level
                                                                ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                                                                : 'text-gray-400 hover:text-gray-200'
                                                        }`}
                                                    >
                                                        {level === 'low' && t.intensityLow}
                                                        {level === 'medium' && t.intensityMedium}
                                                        {level === 'high' && t.intensityHigh}
                                                    </button>
                                                ))}
                                             </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">{t.characterDescription}</label>
                                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t.characterDescriptionPlaceholder} className="w-full bg-gray-700 border-gray-600 rounded-md text-sm" rows={2} />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">{t.threeDActionPromptLabel}</label>
                                        <textarea value={threeDActionPrompt} onChange={e => setThreeDActionPrompt(e.target.value)} placeholder={t.threeDActionPromptPlaceholder} className="w-full bg-gray-700 border-gray-600 rounded-md text-sm" rows={2} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-4 mt-8">
                            <button
                                onClick={handleGenerate}
                                disabled={isAnyLoading}
                                className="flex-grow bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white font-bold py-4 px-6 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transform hover:scale-[1.02] transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center text-lg"
                            >
                                {generatingStates.main ? (
                                    <>
                                        <SpinnerIcon className="w-6 h-6 mr-3" />
                                        {t.generating}...
                                    </>
                                ) : (
                                    t.generateButton
                                )}
                            </button>
                            <button
                                onClick={handleReset}
                                disabled={isAnyLoading}
                                className="p-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                                aria-label={t.resetTooltip}
                            >
                                <ResetIcon className="w-6 h-6" />
                            </button>
                        </div>
                        {error && <p className="text-red-400 mt-4 text-center bg-red-900/20 p-2 rounded border border-red-900">{error}</p>}
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-7">
                    <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-gray-700/50 min-h-[80vh] flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                                <h2 className="text-2xl font-semibold text-teal-400">{t.resultsGeneratedTitle}</h2>
                                <div className="flex-grow h-px bg-gray-700"></div>
                        </div>

                        {/* Grid Layout Always Visible */}
                        <div className="w-full space-y-8 animate-fade-in">
                            
                            {/* Portrait */}
                            <div className="max-w-md mx-auto w-full">
                                    <GeneratedImage 
                                        title={t.portrait} 
                                        imageUrl={generatedPortrait} 
                                        onZoom={setZoomedImageUrl} 
                                        onDownload={() => downloadImage(generatedPortrait, 'portrait.png')} 
                                        onShare={() => handleShare(generatedPortrait)} 
                                        onReGenerate={handleRegeneratePortrait} 
                                        isLoading={generatingStates.main || generatingStates.portrait}
                                        isDependencyMet={true} // Always met for first item
                                    />
                            </div>
                            
                            {/* Ortho Sheet Split Grid */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">{t.orthoSheet}</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <GeneratedImage title={t.orthoFront} imageUrl={generatedOrthoViews.front} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedOrthoViews.front, 'ortho-front.png')} onShare={() => handleShare(generatedOrthoViews.front)} onReGenerate={() => handleRegenerateOrthoView('FRONT')} isLoading={generatingStates.main || generatingStates.orthoFront} isDependencyMet={!!generatedPortrait} />
                                    <GeneratedImage title={t.orthoSide} imageUrl={generatedOrthoViews.side} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedOrthoViews.side, 'ortho-side.png')} onShare={() => handleShare(generatedOrthoViews.side)} onReGenerate={() => handleRegenerateOrthoView('SIDE')} isLoading={generatingStates.main || generatingStates.orthoSide} isDependencyMet={!!generatedPortrait} />
                                    <GeneratedImage title={t.orthoBack} imageUrl={generatedOrthoViews.back} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedOrthoViews.back, 'ortho-back.png')} onShare={() => handleShare(generatedOrthoViews.back)} onReGenerate={() => handleRegenerateOrthoView('BACK')} isLoading={generatingStates.main || generatingStates.orthoBack} isDependencyMet={!!generatedPortrait} />
                                </div>
                            </div>

                            {/* Angled Sheet */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <GeneratedImage title={t.angledSheet} imageUrl={generatedAngledSheet} onZoom={setZoomedImageUrl} onDownload={() => downloadImage(generatedAngledSheet, 'angled-sheet.png')} onShare={() => handleShare(generatedAngledSheet)} onReGenerate={handleRegenerateAngled} isLoading={generatingStates.main || generatingStates.angled} isDependencyMet={!!generatedPortrait} />
                            </div>

                            {/* 3D View */}
                            <div className="w-full">
                                <TurntableGallery
                                    title={t.threeDViews}
                                    sheetUrl={generatedTurntableSheet}
                                    onZoom={setZoomedImageUrl}
                                    onShare={handleShare}
                                    onReGenerate={handleRegenerateTurntable}
                                    isGenerating={generatingStates.main || generatingStates.turntable}
                                    isDependencyMet={!!generatedPortrait}
                                />
                            </div>
                        </div>
                    </div>
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
    isDependencyMet?: boolean;
}

const GeneratedImage: React.FC<GeneratedImageProps> = ({ title, imageUrl, onZoom, onDownload, onShare, onReGenerate, isLoading, isDependencyMet = true }) => {
    const { t } = useLanguage();
    return (
        <div className={`bg-gray-900/60 p-3 rounded-xl shadow-lg border flex flex-col h-full ${imageUrl ? 'border-gray-800' : 'border-gray-800 border-dashed'}`}>
            <h4 className="text-xs font-bold text-gray-300 mb-2 text-center uppercase tracking-wide truncate px-2" title={title}>{title}</h4>
            <div className={`relative aspect-[3/4] flex-grow w-full rounded-lg overflow-hidden group transition-all ${imageUrl ? 'bg-gray-950 ring-1 ring-gray-800 hover:ring-cyan-500/50' : 'bg-gray-900/30 flex items-center justify-center'}`}>
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                        <SpinnerIcon className="w-8 h-8 text-cyan-400 mb-2" />
                        <span className="text-xs text-cyan-300 animate-pulse">{t.generating}...</span>
                    </div>
                ) : imageUrl ? (
                     <>
                        <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => onZoom(imageUrl)} className="text-white hover:text-cyan-400 hover:scale-110 transition-all p-2 bg-gray-800/80 rounded-full shadow-lg flex items-center justify-center" title={t.zoom}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                </button>
                                {onReGenerate && (
                                    <button onClick={onReGenerate} className="text-white hover:text-cyan-400 hover:scale-110 transition-all p-2 bg-gray-800/80 rounded-full shadow-lg flex items-center justify-center" title={t.regenerateTooltip}>
                                        <RegenIcon className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={onShare} className="text-white hover:text-cyan-400 hover:scale-110 transition-all p-2 bg-gray-800/80 rounded-full shadow-lg flex items-center justify-center" title={t.share}>
                                    <ShareIcon className="w-4 h-4" />
                                </button>
                                <button onClick={onDownload} className="text-white hover:text-cyan-400 hover:scale-110 transition-all p-2 bg-gray-800/80 rounded-full shadow-lg flex items-center justify-center" title={t.download}>
                                    <DownloadIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    // Empty State
                    <div className="text-center p-4">
                        {isDependencyMet ? (
                             onReGenerate ? (
                                <button 
                                    onClick={onReGenerate}
                                    className="group/btn flex flex-col items-center text-gray-500 hover:text-cyan-400 transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-2 group-hover/btn:border-cyan-500 group-hover/btn:bg-gray-800/80 group-hover/btn:shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <span className="text-xs font-medium">{t.clickToGenerate}</span>
                                </button>
                             ) : <span className="text-gray-600 text-xs">No Data</span>
                        ) : (
                             <div className="flex flex-col items-center text-gray-600">
                                <div className="w-10 h-10 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center justify-center mb-2">
                                    <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <span className="text-xs font-medium opacity-50">{t.waitingForPortrait}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;

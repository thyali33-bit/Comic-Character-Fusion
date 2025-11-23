
import { GoogleGenAI, Part, GenerateContentResponse } from "@google/genai";
import { Accessories, InfluenceValues, GenerationParams, ExpressionIntensity, OrthoViews } from '../types';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_STANDARD = 'gemini-2.5-flash-image';
const MODEL_HD = 'gemini-3-pro-image-preview';

// Dictionary mapping internal style keys to detailed prompts
const STYLE_PROMPTS: Record<string, string> = {
    ghibli: "Studio Ghibli Style. Hayao Miyazaki aesthetic. Soft, natural lighting. Distinctive facial features. Whimsical and detailed.",
    one_piece: "One Piece Anime Style (Eiichiro Oda). Exaggerated expressions. Bold line art. Dynamic shading.",
    doraemon: "Doraemon Style (Fujiko F. Fujio). Retro, round shapes. Simple, clean lines. 1970s anime aesthetic.",
    chibi: "Chibi Style. 2-3 heads tall. Large head, tiny body. Simplified details. Cute and round.",
    dragon_ball: "Dragon Ball Z Style (Akira Toriyama). Angular musculature. High contrast cel-shading. Thick black outlines. Dynamic energy. DO NOT CHANGE FACE SHAPE.",
    comic: "American Comic Book Style. Jim Lee / Marvel style. Bold black ink outlines. Cross-hatching. Dynamic anatomy. Dramatic lighting.",
    ukiyoe: "Ukiyo-e Style (Japanese Woodblock). Flat perspective. Bold outlines. Traditional patterns. Textured paper feel.",
    renaissance: "Renaissance Oil Painting. Da Vinci style. Sfumato blending. Realistic anatomy. Dramatic chiaroscuro lighting.",
    pixel: "Pixel Art. 16-bit SNES style. Dithering. Limited color palette. Blocky shapes.",
    cyberpunk: "Cyberpunk Concept Art. Neon lights. High tech aesthetic. Chromatic aberration. Dark atmosphere.",
    watercolor: "Watercolor Illustration. Wet-on-wet technique. Paint bleeds. Soft edges. White paper texture.",
    disney_3d: "Disney/Pixar 3D Render Style. Soft subsurface scattering on skin. Expressive features. Ambient occlusion. Cinema lighting."
};

// Helper to find the first image part from a response, or throw error with text content
const findImagePartOrThrow = (response: GenerateContentResponse, context: string): Part => {
    if (!response.candidates?.[0]?.content?.parts) {
        throw new Error(`${context}: Empty response from AI.`);
    }
    
    // Try to find image
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part;
        }
    }

    // If no image, check for text (usually an error/refusal message)
    const textPart = response.candidates[0].content.parts.find(p => p.text);
    if (textPart?.text) {
        throw new Error(`${context} Failed: ${textPart.text}`);
    }

    throw new Error(`${context}: No image generated.`);
};

// Helper to convert base64 URL to a Part object for the Gemini API
const fileToGenerativePart = (base64Data: string): Part => {
  const match = base64Data.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid base64 string format');
  }
  const mimeType = match[1];
  const data = match[2];

  return {
    inlineData: {
      mimeType,
      data,
    },
  };
};

const getBackgroundPrompt = (params: GenerationParams): string => {
    if (params.backgroundType === 'solid') {
        return `BACKGROUND: SOLID FLAT COLOR (${params.backgroundColor}). NO texture, NO gradient, NO shadows.`;
    } else if (params.backgroundType === 'scene') {
        return `BACKGROUND: ${params.backgroundPrompt || 'A suitable environment'}. Cinematic depth of field.`;
    } else {
        return `BACKGROUND: Neutral Studio Grey. Soft gradient. Professional lighting.`;
    }
};

const getStyleDescription = (params: GenerationParams): string => {
    let baseStyle = STYLE_PROMPTS[params.artStyle] || STYLE_PROMPTS['comic'];
    
    if (params.artStylePrompt) {
        baseStyle += ` CUSTOM STYLE TWEAK: ${params.artStylePrompt}.`;
    }

    if (params.isBlackAndWhite) {
        return `${baseStyle} COLOR MODE: BLACK AND WHITE INK ONLY. High contrast. No color.`;
    }
    
    return `${baseStyle} COLOR MODE: FULL VIBRANT COLORS.`;
};

const getExpressionAdjective = (intensity: ExpressionIntensity): string => {
    switch(intensity) {
        case 'low': return 'Slightly';
        case 'high': return 'Extremely';
        default: return 'Moderately';
    }
};

// --- CHIMERA PROMPT BUILDER ---
const buildChimeraPrompt = (params: GenerationParams, specificViewInstructions: string, manifest: string): string => {
    const shouldIncludeAccessories = params.clothingImage && params.enableColorOverride;

    const accessoriesList = shouldIncludeAccessories
        ? Object.entries(params.accessories)
            .filter(([_, enabled]) => enabled)
            .map(([name]) => name)
            .join(', ')
        : '';
    
    const accessoriesPrompt = accessoriesList 
        ? `MANDATORY ACCESSORIES: ${accessoriesList}.` 
        : '';

    const colorOverride = params.enableColorOverride
        ? `COLOR PALETTE OVERRIDE: Ignore Source 2 colors. REPAINT outfit using Primary: ${params.primaryColor}, Secondary: ${params.secondaryColor}.`
        : `COLOR PALETTE: STRICTLY KEEP colors from Source 2 (Outfit).`;

    const backgroundInstruction = getBackgroundPrompt(params);
    const styleInstruction = getStyleDescription(params);
    const characterDesc = params.prompt ? `CHARACTER TRAITS: ${params.prompt}` : '';

    return `
    ROLE: You are a forensic artist and master character designer.
    
    --- INPUT MANIFEST ---
    ${manifest}

    --- MASTER INSTRUCTION ---
    Create a composite character by merging the sources below.
    
    1. **FACE (SOURCE 1 - IDENTITY LOCK)**:
       - **PRIORITY: ABSOLUTE**.
       - **GEOMETRY LOCK**: You MUST preserve the exact geometric shape of Source 1's eyes, nose, mouth, and jawline.
       - **STRICT RULE FOR ANIME STYLES (e.g., Dragon Ball)**: 
         - DO NOT replace the source eyes with generic Anime/Goku eyes. 
         - DO NOT simplify the nose to a triangle.
         - Keep the Source 1 facial anatomy, just apply the *shading* and *line weight* of the style.
       - **FACE SWAP TECHNIQUE**: Imagine you are photoshopping Source 1's face onto the drawing, then applying a style filter. 
       - The *likeness* must be unmistakable. If the output face looks generic, you have FAILED.

    2. **OUTFIT (SOURCE 2 - COSTUME)**:
       - **PRIORITY: HIGH**.
       - The character is wearing the outfit from Source 2.
       - Copy the design details (buttons, patterns, shape) exactly.
       - ${colorOverride}
       - ${accessoriesPrompt}

    3. **ART STYLE (RENDERING ENGINE)**:
       - ${styleInstruction}
       - Apply this style's lighting, shading, and texture to the whole image.

    --- OUTPUT TASK ---
    ${specificViewInstructions}
    
    ${characterDesc}
    
    ${backgroundInstruction}
    `;
};

export const generateCharacterAssets = async (params: GenerationParams) => {
    console.log("Starting full character generation...");
    
    // 1. Generate the main Portrait first
    const portrait = await generatePortrait(params);
    
    // 2. Generate the sheets in parallel.
    // Split Ortho generation into 3 individual frames
    const [orthoFront, orthoSide, orthoBack, angledSheet, turntableSheet] = await Promise.all([
        generateOrthoView(portrait, params, 'FRONT'),
        generateOrthoView(portrait, params, 'SIDE'),
        generateOrthoView(portrait, params, 'BACK'),
        generateAngledSheet(portrait, params),
        generateTurntableViews(portrait, params)
    ]);

    const orthoViews: OrthoViews = {
        front: orthoFront,
        side: orthoSide,
        back: orthoBack
    };

    return { portrait, orthoViews, angledSheet, turntableSheet };
};

export const generatePortrait = async (params: GenerationParams): Promise<string> => {
    const parts: Part[] = [];
    let manifest = "";
    let imageCounter = 0;
    const imageParts: Part[] = [];

    // 1. FACE (Source 1)
    if (params.faceImage) {
        imageParts.push(fileToGenerativePart(params.faceImage));
        imageCounter++;
        manifest += `IMAGE ${imageCounter}: [Source 1 - FACE IDENTITY] **CRITICAL**. Use this EXACT face.\n`;
    }

    // 2. CLOTHING (Source 2)
    if (params.clothingImage) {
        imageParts.push(fileToGenerativePart(params.clothingImage));
        imageCounter++;
        manifest += `IMAGE ${imageCounter}: [Source 2 - OUTFIT] Copy this clothing design.\n`;
    }

    manifest += `STYLE: ${params.artStyle}.\n`;
    
    const expressionText = params.facialExpression === 'from_reference' 
        ? 'MATCH SOURCE 1 EXPRESSION EXACTLY' 
        : `${getExpressionAdjective(params.facialExpressionIntensity)} ${params.facialExpression}`;

    const prompt = buildChimeraPrompt(params, `
        VIEW: CLOSE-UP BUST PORTRAIT (Head and Shoulders).
        COMPOSITION: Front-facing, centered.
        INSTRUCTION: Generate a high-quality portrait. Ensure the face matches Source 1 perfectly in terms of anatomy.
        POSE: Expression: ${expressionText}.
        CROP: Head to Chest ONLY. Do not draw full body.
    `, manifest);

    parts.push({ text: prompt });
    parts.push(...imageParts);

    const modelName = params.quality === 'hd' ? MODEL_HD : MODEL_STANDARD;
    
    const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "1:1",
                numberOfImages: 1
            }
        }
    });

    const imagePart = findImagePartOrThrow(response, "Portrait Generation");
    return `data:${imagePart.inlineData!.mimeType};base64,${imagePart.inlineData!.data}`;
};

export const generateOrthoView = async (portraitImage: string, params: GenerationParams, viewType: 'FRONT' | 'SIDE' | 'BACK'): Promise<string> => {
    const parts: Part[] = [];
    
    // Inject Original Outfit Source for Design Precision
    if (params.clothingImage) {
        parts.push({ text: "REFERENCE A (OUTFIT DESIGN - STRICT):" });
        parts.push(fileToGenerativePart(params.clothingImage));
    }

    // Inject Generated Portrait for Head Consistency
    parts.push({ text: "REFERENCE B (HEAD/FACE - STRICT):" });
    parts.push(fileToGenerativePart(portraitImage));

    const viewInstructions = {
        'FRONT': "VIEW: FRONT VIEW. Full body. Facing camera directly.",
        'SIDE': "VIEW: LEFT SIDE VIEW (PROFILE). Full body. Facing left.",
        'BACK': "VIEW: BACK VIEW. Full body. Facing away."
    };

    const prompt = `
    TASK: Generate a Single Technical Orthographic Frame: ${viewType}.
    
    STYLE: ${getStyleDescription(params)}
    
    INSTRUCTIONS:
    1. Draw the character from REFERENCE B (Head) wearing the outfit from REFERENCE A.
    2. **IDENTITY**: You MUST use the exact face/head from REFERENCE B. Do not redraw the face with different features.
    3. **VIEW**: ${viewInstructions[viewType]}
    4. **PROJECTION**: Orthographic/Parallel projection. No foreshortening. No perspective distortion.
    5. **POSE**: ${params.orthoPose.toUpperCase()} (Neutral Standing). Arms slightly away from body. Legs straight.
    6. **FRAMING**: FULL BODY. Do not crop head or feet. Centered.
    
    BACKGROUND: Plain White.
    `;

    parts.unshift({ text: prompt });

    const modelName = params.quality === 'hd' ? MODEL_HD : MODEL_STANDARD;

    // Use 9:16 for individual character frames (tall aspect ratio)
    const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "9:16", 
                numberOfImages: 1
            }
        }
    });

    const imagePart = findImagePartOrThrow(response, `Ortho ${viewType} Generation`);
    return `data:${imagePart.inlineData!.mimeType};base64,${imagePart.inlineData!.data}`;
};

export const generateAngledSheet = async (portraitImage: string, params: GenerationParams): Promise<string> => {
    const parts: Part[] = [];

    if (params.clothingImage) {
        parts.push({ text: "REFERENCE A (OUTFIT - DO NOT CHANGE DESIGN):" });
        parts.push(fileToGenerativePart(params.clothingImage));
    }

    parts.push({ text: "REFERENCE B (HEAD - DO NOT CHANGE FACE):" });
    parts.push(fileToGenerativePart(portraitImage));

    const prompt = `
    TASK: Generate a DYNAMIC ACTION POSE SHEET.
    
    STYLE: ${getStyleDescription(params)}
    
    INSTRUCTIONS:
    1. Character: Head from Ref B, Outfit from Ref A.
    2. **IDENTITY**: Strictly preserve the face from Reference B.
    3. **ACTION**: Create 3 or 4 distinct, energetic poses.
    4. **POSE TYPE**: ${params.angledPose}.
    5. **COMPOSITION**: Distribute poses evenly on the page.
    
    BACKGROUND: ${getBackgroundPrompt(params)}
    `;

    parts.unshift({ text: prompt });

    const modelName = params.quality === 'hd' ? MODEL_HD : MODEL_STANDARD;

    const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "3:4",
                numberOfImages: 1
            }
        }
    });

    const imagePart = findImagePartOrThrow(response, "Angled Sheet Generation");
    return `data:${imagePart.inlineData!.mimeType};base64,${imagePart.inlineData!.data}`;
};

export const generateTurntableViews = async (portraitImage: string, params: GenerationParams): Promise<string> => {
    const parts: Part[] = [];

    if (params.clothingImage) {
        parts.push({ text: "REFERENCE A (OUTFIT):" });
        parts.push(fileToGenerativePart(params.clothingImage));
    }

    parts.push({ text: "REFERENCE B (HEAD):" });
    parts.push(fileToGenerativePart(portraitImage));

    let baseStyle = STYLE_PROMPTS[params.artStyle] || STYLE_PROMPTS['comic'];
    if (params.artStylePrompt) baseStyle += ` ${params.artStylePrompt}`;

    const threeDStylePrompt = `
    TRANSFORM STYLE INTO 3D: Interpret "${baseStyle}" as a high-fidelity digital figure.
    RENDER: Octane Render, Global Illumination, Soft Shadows.
    MATERIAL: Matte skin, realistic fabric textures.
    ${params.isBlackAndWhite ? 'COLOR: Clay Render (Greyscale).' : 'COLOR: Full Color Render.'}
    `;

    const prompt = `
    TASK: Generate a 2x2 SPRITE SHEET for a 3D Turntable.
    
    INSTRUCTIONS:
    1. Character: Head from Ref B, Outfit from Ref A.
    2. **IDENTITY**: STICK TO THE FACE OF REF B.
    3. **LAYOUT**: 2x2 Grid.
       Top-Left: FRONT View
       Top-Right: RIGHT View
       Bottom-Left: BACK View
       Bottom-Right: LEFT View
    4. **CONSTRAINT**: Frozen pose. Only camera rotates.
    5. **POSE**: ${params.threeDActionPrompt || 'Standing Heroic Pose'}.
    
    STYLE: ${threeDStylePrompt}
    BACKGROUND: ${getBackgroundPrompt(params)}
    `;

    parts.unshift({ text: prompt });

    const response = await ai.models.generateContent({
        model: MODEL_HD, 
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "1:1",
                numberOfImages: 1,
                imageSize: "2K"
            }
        }
    });

    const imagePart = findImagePartOrThrow(response, "3D Turntable Generation");
    return `data:${imagePart.inlineData!.mimeType};base64,${imagePart.inlineData!.data}`;
};

export const generate3DViewAngle = async (portraitImage: string, params: GenerationParams, angle: number): Promise<string> => {
    const parts: Part[] = [];
    
    if (params.clothingImage) {
        parts.push({ text: "OUTFIT REF" });
        parts.push(fileToGenerativePart(params.clothingImage));
    }
    parts.push({ text: "HEAD REF" });
    parts.push(fileToGenerativePart(portraitImage));

    let baseStyle = STYLE_PROMPTS[params.artStyle] || STYLE_PROMPTS['comic'];
    if (params.artStylePrompt) baseStyle += ` ${params.artStylePrompt}`;

    const threeDStylePrompt = `
    Interpret style "${baseStyle}" as a 3D RENDER.
    High fidelity, ray tracing.
    ${params.isBlackAndWhite ? 'Greyscale Clay Render.' : 'Full Color.'}
    `;

    const prompt = `
    Render a single view of the character at ${angle} degrees (Y-axis rotation).
    HEAD: Matches HEAD REF exactly.
    OUTFIT: Matches OUTFIT REF exactly.
    STYLE: ${threeDStylePrompt}
    ACTION: ${params.threeDActionPrompt || 'Standing'}.
    `;
    
    parts.unshift({ text: prompt });
    
    const response = await ai.models.generateContent({
        model: MODEL_HD,
        contents: { parts },
        config: { 
            imageConfig: { 
                aspectRatio: "1:1", 
                numberOfImages: 1,
                imageSize: "2K"
            } 
        }
    });
    
    const imagePart = findImagePartOrThrow(response, "Single 3D View Generation");
    return `data:${imagePart.inlineData!.mimeType};base64,${imagePart.inlineData!.data}`;
};

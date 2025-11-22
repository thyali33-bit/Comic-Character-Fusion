
import { GoogleGenAI, Part, GenerateContentResponse } from "@google/genai";
import { Accessories, InfluenceValues, GenerationParams } from '../types';

// Helper to find the first image part from a response
const findImagePart = (response: GenerateContentResponse): Part | undefined => {
    if (!response.candidates?.[0]?.content?.parts) {
        return undefined;
    }
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part;
        }
    }
    return undefined;
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

const getInfluenceStrength = (value: number): string => {
    if (value > 90) return "Dominant. Follow this reference strictly.";
    if (value > 50) return "Strong. Incorporate key elements.";
    return "Subtle. Use as a minor hint.";
};

const getQualityPrompt = (quality: string): string => {
    if (quality === 'hd') {
        return `
          **QUALITY MANDATE (HD):**
          - Generate an ultra-high-quality, 4K resolution image.
          - Meticulous attention to detail, clean linework, and sophisticated shading.
          - Professional portfolio-grade finish.
        `;
    }
    return `
      **QUALITY MANDATE (Standard):**
      - High-quality digital image, clear and visually appealing.
    `;
};

// Helper function to build the accessories string
const buildAccessoriesString = (accessories: Accessories, clothingImage: string | null): string => {
    const accessoriesToSave = Object.entries(accessories)
        .filter(([, value]) => value)
        .map(([key]) => {
            if (key === 'bracelets') return 'bracelets (vòng tay)';
            if (key === 'necklaces') return 'necklaces (vòng cổ)';
            if (key === 'earrings') return 'earrings (khuyên tai)';
            if (key === 'eyeglasses') return 'eyeglasses (kính mắt)';
            return '';
        })
        .filter(Boolean);
    
    return (clothingImage && accessoriesToSave.length > 0)
        ? `**ACCESSORIES CHECKLIST:** You MUST include these specific items from the Clothing Reference (Image 2): ${accessoriesToSave.join(', ')}. If Image 2 has a hat/helmet, include it.`
        : "Do not include jewelry unless it is built into the clothing. If Image 2 has a hat/helmet, include it.";
};

const buildChimeraPrompt = (params: GenerationParams): string => {
    const { faceImage, clothingImage, styleImage, accessories, influences, prompt, primaryColor, secondaryColor, enableColorOverride } = params;
    const accessoriesStr = buildAccessoriesString(accessories, clothingImage);

    let chimeraPrompt = `
    **MISSION: CHIMERA CHARACTER SYNTHESIS**
    You are an advanced character engine. Your task is to construct a new character by surgically combining attributes from specific source images.
    
    **STRICT SOURCE ASSIGNMENT (DO NOT MIX THESE ROLES):**
    `;

    if (faceImage) {
        chimeraPrompt += `
    1.  **IMAGE ASSET 1 (THE FACE) -> BIOLOGICAL SOURCE**
        *   **Input:** The first image provided.
        *   **Action:** Extract the facial features (eyes, nose, mouth, jaw, skin tone).
        *   **Rule:** The final character's face MUST look like this person.
        `;
    }

    if (clothingImage) {
        chimeraPrompt += `
    2.  **IMAGE ASSET 2 (THE COSTUME) -> MANNEQUIN SOURCE**
        *   **Input:** The second image provided.
        *   **Action:** Extract the outfit, hat, helmet, and glasses.
        *   **CRITICAL CONSTRAINT:** Treat this image as a **HEADLESS MANNEQUIN**.
            - **IGNORE THE FACE** of the person in this image.
            - **IGNORE THE BODY PROPORTIONS** (height, weight, build) of this image.
            - ONLY take the clothing items and wrap them around the body defined by Image 3.
        *   ${accessoriesStr}
        `;
    }

    if (styleImage) {
        chimeraPrompt += `
    3.  **IMAGE ASSET 3 (THE STYLE & ANATOMY) -> ART DIRECTOR**
        *   **Input:** The third image provided.
        *   **Action:** Extract the Art Style (line weight, coloring, shading) AND the **BODY PROPORTIONS**.
        *   **Rule:**
            - If Image 3 is Chibi, the result MUST be Chibi.
            - If Image 3 is a muscular giant, the result MUST be a muscular giant.
            - If Image 3 is a slender anime character, the result MUST be slender.
            - **Use the anatomy/skeleton of Image 3, wearing the clothes of Image 2, with the face of Image 1.**
        *   **Negative Constraint:** Do NOT copy specific unique features (horns, wings, tail) from Image 3 unless they are part of the generic body type.
        `;
    }

    if (enableColorOverride) {
        chimeraPrompt += `
    **COLOR OVERRIDE INSTRUCTIONS:**
    You MUST override the original colors of the clothing from Image 2 with the following palette:
    - **Primary Color (Main Fabrics/Armor):** ${primaryColor}
    - **Secondary Color (Accents/Trims/Details):** ${secondaryColor}
    - Apply these colors logically to the outfit extracted from Image 2.
    `;
    }

    chimeraPrompt += `
    **USER DESCRIPTION:** ${prompt || "Create a full body shot."}
    
    **INFLUENCE SETTINGS:**
    - Character Face Similarity: ${getInfluenceStrength(influences.character)}
    - Clothing Accuracy: ${getInfluenceStrength(influences.clothing)}
    - Style/Proportions adherence: ${getInfluenceStrength(influences.style)}
    `;

    return chimeraPrompt;
};

export const generatePortrait = async (params: GenerationParams): Promise<string> => {
    const { faceImage, styleImage, clothingImage, quality } = params;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    const imageInputs: { role: 'user', parts: Part[] }[] = [];
    const parts: Part[] = [];

    // Order matters for the prompt references "Image Asset 1", etc.
    if (faceImage) parts.push(fileToGenerativePart(faceImage));
    if (clothingImage) parts.push(fileToGenerativePart(clothingImage));
    if (styleImage) parts.push(fileToGenerativePart(styleImage));

    const systemPrompt = `
    ${buildChimeraPrompt(params)}
    ${getQualityPrompt(quality)}
    
    **FINAL OUTPUT INSTRUCTION:**
    Generate a single, full-body character portrait on a simple background. 
    Ensure the head (Image 1) connects naturally to the body (Image 3 proportions) wearing the clothes (Image 2).
    `;

    parts.push({ text: systemPrompt });
    imageInputs.push({ role: 'user', parts });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: imageInputs,
        config: {
            temperature: 0.4, // Lower temperature for better adherence to instructions
        }
    });

    const imagePart = findImagePart(response);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error("No image generated. Please try again.");
    }

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
};

export const generateOrthoSheet = async (portraitImage: string, params: GenerationParams): Promise<string> => {
    const { orthoPose, quality } = params;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const prompt = `
    **TASK: CHARACTER REFERENCE SHEET**
    Input Image: The "Canonical Character Design".
    
    Generate an **Orthographic Character Sheet** for this EXACT character.
    - **Views:** Front, Back, Left Side, Right Side.
    - **Pose:** ${orthoPose} (consistent across all views).
    - **Style:** Flat, clean lines, neutral lighting (Reference Sheet style).
    - **Consistency:** ABSOLUTE. The face, outfit, and proportions must match the Input Image perfectly.
    ${getQualityPrompt(quality)}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [fileToGenerativePart(portraitImage), { text: prompt }]
            }
        ]
    });

    const imagePart = findImagePart(response);
    if (!imagePart || !imagePart.inlineData) {
         throw new Error("No image generated.");
    }

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
};

export const generateAngledSheet = async (portraitImage: string, params: GenerationParams): Promise<string> => {
    const { angledPose, quality } = params;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const prompt = `
    **TASK: DYNAMIC POSE SHEET**
    Input Image: The "Canonical Character Design".
    
    Generate a sheet with **4 different dynamic poses** of this character.
    - **Pose Theme:** ${angledPose}.
    - **Consistency:** The character must look identical to the Input Image in every pose (same face, same clothes).
    ${getQualityPrompt(quality)}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [fileToGenerativePart(portraitImage), { text: prompt }]
            }
        ]
    });

    const imagePart = findImagePart(response);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error("No image generated.");
    }

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
};

export const generateTurntableViews = async (portraitImage: string, params: GenerationParams): Promise<string> => {
    const { quality, threeDActionPrompt, styleImage } = params;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    // We include the style image to enforce anatomy, but rely on portrait for the design.
    const parts = [fileToGenerativePart(portraitImage)];
    if (styleImage) parts.push(fileToGenerativePart(styleImage));

    const actionText = threeDActionPrompt ? `Action: ${threeDActionPrompt}` : "Pose: A-Pose or Neutral Standing";

    const prompt = `
    **TASK: 3D MODEL TEXTURE/SPRITE SHEET GENERATION**
    
    **INPUTS:**
    1. **Image 1 (Primary):** The Master Character Design.
    2. **Image 2 (Secondary):** Anatomy/Style Reference (Use ONLY for body proportions if Image 1 is unclear).

    **OBJECTIVE:**
    Generate a **2x2 Sprite Sheet** containing 4 rotation views of the character from Image 1.
    - Top-Left: 0 degrees (Front)
    - Top-Right: 90 degrees (Right Profile)
    - Bottom-Left: 180 degrees (Back)
    - Bottom-Right: 270 degrees (Left Profile)

    **STRICT CONSTRAINTS:**
    1.  **THE DIGITAL STATUE RULE:** Treat the character as a solid, frozen 3D object. The pose, facial expression, hair physics, and clothing folds must be IDENTICAL in all 4 slots. Only the camera moves.
    2.  **PROPORTIONS:** You MUST respect the body proportions (height, head-to-body ratio) of the provided images. **Do NOT default to realistic proportions if the input is stylized/chibi.**
    3.  **CONSISTENCY:** The face in the 0 degree view must match the input portrait perfectly. The back view must logically deduce the back of the outfit based on the front.
    4.  **RENDERING:** High-end 3D render style, 4K, ambient occlusion, cinematic lighting.
    
    ${actionText}
    ${getQualityPrompt(quality)}
    `;
    
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }]
    });

    const imagePart = findImagePart(response);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error("No turntable generated.");
    }

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
};

export const generate3DViewAngle = async (portraitImage: string, params: GenerationParams, angle: number): Promise<string> => {
     // Deprecated/Legacy support if needed, but TurntableGallery uses the sheet now.
     // We map single angle requests to a similar logic if called individually.
    return generateTurntableViews(portraitImage, params);
};

export const generateCharacterAssets = async (params: GenerationParams) => {
    const portrait = await generatePortrait(params);

    const [orthoSheet, angledSheet, turntableSheet] = await Promise.all([
        generateOrthoSheet(portrait, params),
        generateAngledSheet(portrait, params),
        generateTurntableViews(portrait, params)
    ]);

    return {
        portrait,
        orthoSheet,
        angledSheet,
        turntableSheet
    };
};

export const generateVariationAssets = async (basePortrait: string, strength: number, params: GenerationParams) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    const prompt = `
    **TASK: CHARACTER VARIATION**
    Input: A character portrait.
    Action: Create a variation of this character with a ${strength}% deviation.
    - Keep the core identity and color palette.
    - Slightly alter the pose or accessory details.
    - Maintain the original art style.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [fileToGenerativePart(basePortrait), { text: prompt }]
            }
        ]
    });

    const imagePart = findImagePart(response);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error("Failed to generate variation.");
    }

    const newPortrait = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    
    // Regenerate sheets based on new portrait
    const [orthoSheet, angledSheet, turntableSheet] = await Promise.all([
        generateOrthoSheet(newPortrait, params),
        generateAngledSheet(newPortrait, params),
        generateTurntableViews(newPortrait, params)
    ]);

    return {
        portrait: newPortrait,
        orthoSheet,
        angledSheet,
        turntableSheet
    };
};


import { GoogleGenAI, Modality, Part } from "@google/genai";
import { Accessories, InfluenceValues, GenerationParams } from '../types';

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
    if (value > 95) return "an absolute, non-negotiable mandate for a **stylized likeness**. The final character's face **MUST BE INSTANTLY RECOGNIZABLE** as the person in the reference photo, rendered in the target art style. Capture their unique facial structure, features, and essence with the highest possible fidelity. This is the top priority.";
    if (value > 80) return "a primary and critical directive";
    if (value > 60) return "a strong and heavily prioritized guideline";
    if (value > 40) return "a significant factor";
    if (value > 20) return "a moderate suggestion";
    return "a minor source of inspiration";
};

const getExpressionIntensity = (value: number): string => {
    if (value > 90) return "an extremely intense and exaggerated";
    if (value > 70) return "a strong and clearly defined";
    if (value > 40) return "a noticeable but moderate";
    if (value > 10) return "a subtle hint of a";
    return "an almost imperceptible trace of a";
};


const getFinalCheck = (value: number): string => {
    if (value > 95) return "Before outputting, confirm one last time: Does the style perfectly match the rules you derived? The final output's style must be indistinguishable from the Style Reference. This is the most critical instruction.";
    if (value > 80) return "Before outputting, do a final check to ensure the style is a very close match to your analysis. Major deviations are not acceptable.";
    if (value > 60) return "Before outputting, ensure the style strongly reflects your analysis of the reference image.";
    if (value > 40) return "Before outputting, check that the style is significantly influenced by your analysis of the reference image.";
    return "Before outputting, check that the style incorporates some elements from your analysis of the reference image.";
}

const getQualityPrompt = (quality: string): string => {
    if (quality === 'hd') {
        return `
          **QUALITY MANDATE (HD):**
          - Generate an ultra-high-quality, print-resolution image.
          - Pay meticulous attention to detail, ensuring clean, crisp linework.
          - Employ sophisticated shading, lighting, and texturing to create depth and realism.
          - The final output must be of a professional, portfolio-grade finish.
        `;
    }
    return `
      **QUALITY MANDATE (Standard):**
      - Generate a high-quality image suitable for web and digital display.
      - Ensure the image is clear, well-defined, and visually appealing.
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
        ? `You MUST also include the following accessories from the Clothing Reference (Image Asset 2): ${accessoriesToSave.join(', ')}.`
        : "Do not include any accessories like jewelry unless they are integral to the clothing itself.";
};

// Helper function to build the consistency mandate prompt
const buildConsistencyMandate = (accessoriesString: string, clothingImage: string | null): string => {
    if (clothingImage) {
        return `
          **THE GOLDEN RULE (ABSOLUTE):**
          You MUST combine the head from **Image Asset 1 ("THE HEAD")** with the outfit from **Image Asset 2 ("THE OUTFIT")**.
          - **Image Asset 1 ("THE HEAD"):** The first input image. This is the **ONLY** source for the character's head (face, hair, expression, and the style of the head).
          - **Image Asset 2 ("THE OUTFIT"):** The second input image. This is the **ONLY** source for the character's full-body clothing.
          - The face from "THE OUTFIT" image is **FORBIDDEN**. Using it is a critical failure.

          **FACIAL CONSISTENCY MANDATE:**
          The character's face is **LOCKED**. When you redraw the character in new poses, the face **MUST BE a perfect, identical replica** of the face from **Image Asset 1**. Do not change the expression, features, or hairstyle. Treat the head as a rigid 3D object that you are simply viewing from different angles.
          
          **CLOTHING INSTRUCTIONS:**
          - The **ENTIRE OUTFIT** (top, bottom, shoes, etc.) MUST be taken **EXCLUSIVELY** from **Image Asset 2 ("THE OUTFIT")**.
          - **Accessories:** ${accessoriesString}
        `;
    } else {
        return `
            **LAW OF FACIAL IDENTITY (ABSOLUTE & UNBREAKABLE):**
            You have been provided with one image, the "Generated Character Portrait". This image is the **UNALTERABLE, CANONICAL, AND DEFINITIVE** source for the character's **ENTIRE APPEARANCE AND IDENTITY**.

            **YOUR CRITICAL MISSION: "FULL BODY TRACING"**
            - **THE LAW:** The character's **ENTIRE BEING**—face, head, hair, clothing, and art style—in **EVERY SINGLE DRAWING** must be an **EXACT, FLAWLESS, 1:1 REPLICATION** of the "Generated Character Portrait".
            - **FACIAL CONSISTENCY:** The character's face is **LOCKED**. It **MUST BE a perfect, identical replica** of the face from the portrait. **DO NOT** change the expression or features. Treat the head as a rigid, unchangeable 3D object.
            - **MENTAL MODEL:** Your only job is to re-pose and redraw the exact same character from different camera angles. **NO ARTISTIC INTERPRETATION OR DEVIATION IS ALLOWED.**
        `;
    }
};

export const generateCharacterAssets = async (
  faceImage: string | null,
  styleImage: string | null,
  clothingImage: string | null,
  accessories: Accessories,
  influences: InfluenceValues,
  orthoPose: string,
  angledPose: string,
  facialExpression: string,
  facialExpressionIntensity: number,
  seed: number | null,
  quality: string
): Promise<{ portrait: string; orthoSheet: string; angledSheet: string; turntableViews: string[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  try {
    const imageInputs: { role: 'face' | 'clothing' | 'style', base64: string }[] = [];
    if (faceImage) imageInputs.push({ role: 'face', base64: faceImage });
    if (clothingImage) imageInputs.push({ role: 'clothing', base64: clothingImage });
    if (styleImage) imageInputs.push({ role: 'style', base64: styleImage });

    const portraitParts: Part[] = imageInputs.map(input => fileToGenerativePart(input.base64));
    
    const characterStrength = getInfluenceStrength(influences.character);
    const clothingStrength = getInfluenceStrength(influences.clothing);
    const styleStrength = getInfluenceStrength(influences.style);

    const expressionIntensityStrength = getExpressionIntensity(facialExpressionIntensity);
    let expressionInstruction: string;
    const faceInputIndex = imageInputs.findIndex(i => i.role === 'face');
    if (facialExpression === 'neutral') {
        expressionInstruction = "The character should have a neutral, composed facial expression.";
    } else if (facialExpression === 'from_face_reference' && faceImage) {
        expressionInstruction = `**EXPRESSION MANDATE:** The character's facial expression MUST be an exact, faithful replication of the expression seen in the 'Character Face Reference' image (Image ${faceInputIndex + 1}). This is a critical directive. Do not alter or change it.`;
    } else {
        expressionInstruction = `**EXPRESSION MANDATE:** The character's facial expression MUST be ${expressionIntensityStrength} **${facialExpression}** expression. This is a critical directive.`;
    }
    
    const accessoriesString = buildAccessoriesString(accessories, clothingImage);
    
    const qualityPrompt = getQualityPrompt(quality);
    const styleInputIndex = imageInputs.findIndex(i => i.role === 'style');
    const clothingInputIndex = imageInputs.findIndex(i => i.role === 'clothing');
    const finalStyleCheck = getFinalCheck(influences.style);

    const portraitPrompt = `
      **PRIMARY OBJECTIVE: Character Synthesis**
      Your mission is to create a new character portrait by analyzing and synthesizing features from three source images. You are an expert comic book character designer.

      **SOURCE MATERIAL ANALYSIS:**
      1.  **IMAGE ${faceInputIndex + 1} (Face Reference):** This image defines the character's **identity**. Analyze its facial structure, features, hair, and expression. Your adherence to this identity is: **${characterStrength}**.
      2.  **IMAGE ${clothingInputIndex + 1} (Clothing Reference):** This image defines the character's **outfit**. Analyze the complete attire. Your adherence to this outfit is: **${clothingStrength}**.
      3.  **IMAGE ${styleInputIndex + 1} (Style Reference):** This image defines the **art style**. Analyze its line work, coloring, shading, and overall aesthetic. Your adherence to this style is: **${styleStrength}**.

      **SYNTHESIS INSTRUCTIONS (The Plan):**
      You will now create a **completely new image**. This new image must depict a character that is a perfect fusion of your analysis:
      - The **person** from the Face Reference.
      - The **clothing** from the Clothing Reference.
      - Rendered in the **art style** of the Style Reference.

      **CRITICAL ASSEMBLY RULES (NON-NEGOTIABLE):**
      1.  **FORBIDDEN CONTENT - Style Reference:** The person, clothing, and background in the Style Reference image are **BANNED**. You are only allowed to copy its **ART STYLE**. Using any content from it is a total failure.
      2.  **FORBIDDEN CONTENT - Face Reference:** You MUST IGNORE the clothing in the Face Reference image.
      3.  **FORBIDDEN CONTENT - Clothing Reference:** You MUST IGNORE the face in the Clothing Reference image.
      4.  **NO "CUT AND PASTE":** Do not simply copy and paste parts of the images. You must redraw the character from scratch based on the synthesis plan. The final image must be a single, coherent, well-composed artwork.

      ${expressionInstruction}
      ${qualityPrompt}

      **FINAL OUTPUT SPECIFICATIONS:**
      -   **Composition:** A "bust shot" (head and shoulders only). NO hands or arms.
      -   **Aspect Ratio:** Exactly 1:1 (square, 1024x1024px).
      -   **Background:** Solid medium gray (#808080).

      **FINAL CHECK:** ${finalStyleCheck} Does the character in your final image wear the outfit from the Style Reference? If so, you have failed. Start over. The outfit MUST come from the Clothing Reference.
    `;
    
    const generationConfig: { responseModalities: Modality[], seed?: number } = {
        responseModalities: [Modality.IMAGE]
    };
    if (seed !== null && seed !== undefined) {
        generationConfig.seed = seed;
    }

    // STEP 1: Generate the portrait first to establish the character's definitive look.
    const portraitResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: portraitPrompt }, ...portraitParts] },
        config: generationConfig
    });
    
    const portraitResultPart = portraitResponse.candidates?.[0]?.content?.parts?.[0];
    if (!portraitResultPart?.inlineData) {
        throw new Error("Failed to generate the character portrait.");
    }
    const portraitImage = `data:${portraitResultPart.inlineData.mimeType};base64,${portraitResultPart.inlineData.data}`;
    
    // STEP 2: Generate the other assets in parallel
    const sheetParts: Part[] = [
      fileToGenerativePart(portraitImage)
    ];
    if (clothingImage) {
        sheetParts.push(fileToGenerativePart(clothingImage));
    }
    const consistencyMandate = buildConsistencyMandate(accessoriesString, clothingImage);
    
    let orthoPoseInstruction = "in a neutral, standing A-pose";
    switch (orthoPose) {
        case 'sitting':
            orthoPoseInstruction = "in a simple sitting pose, as if on an invisible chair";
            break;
        case 'lying down':
            orthoPoseInstruction = "in a simple pose lying flat on their back";
            break;
        case 'jumping':
            orthoPoseInstruction = "in a dynamic high-jump pose, frozen mid-air";
            break;
        case 'bowing':
            orthoPoseInstruction = "in a pose of bending forward at the waist in a bow";
            break;
        case 'random':
            orthoPoseInstruction = "in a dynamic and interesting pose of your choice";
            break;
    }

    const orthoSheetPrompt = `
      You are an expert comic book character designer. Your task is to generate a character sheet with orthographic views.
      **INPUTS:** Image 1 is the definitive character portrait ("THE HEAD"). Image 2 is the clothing reference ("THE OUTFIT").
      **CRITICAL FORMATTING MANDATE:** Your ONLY task is to produce a SINGLE IMAGE laid out as a 2x2 GRID.
      - **Structure:** One image file, four equal quadrants (2x2 grid).
      - **Content:** EXACTLY FOUR drawings of the character, one in each quadrant.
      - **Background:** Uniform medium gray (#808080).
      - **Aspect Ratio:** **MUST BE EXACTLY 9:16 (tall portrait, 736x1408px)**. This is non-negotiable.
      - **FAILURE to produce a perfect 4-view, 2x2 grid means you have FAILED the entire request.**
      ${qualityPrompt}
      ${consistencyMandate}
      **Grid Content (Strict Mapping):** Draw the character ${orthoPoseInstruction}. The pose must be identical in all four views.
      - **Top-Left:** "Front View"
      - **Top-Right:** "Back View"
      - **Bottom-Left:** "Left Side View" (character's LEFT, looking left)
      - **Bottom-Right:** "Right Side View" (character's RIGHT, looking right)
    `;
    
    let angledPoseInstruction: string;
    switch (angledPose) {
        case 'standing':
            angledPoseInstruction = "The character MUST be standing in all four views. Each view should feature a unique, dynamic standing pose.";
            break;
        case 'sitting':
            angledPoseInstruction = "The character MUST be sitting in all four views. Each view should feature a unique, dynamic sitting pose.";
            break;
        case 'lying down':
            angledPoseInstruction = "The character MUST be lying down in all four views. Each view should feature a unique, dynamic pose while lying down.";
            break;
        case 'jumping':
            angledPoseInstruction = "The character MUST be in a jumping or mid-air pose in all four views. Each view should feature a unique, dynamic jump.";
            break;
        case 'bowing':
            angledPoseInstruction = "The character MUST be bowing or bent over in all four views. Each view should feature a unique, dynamic bowing pose.";
            break;
        case 'random':
        default:
            angledPoseInstruction = "You are to generate four dynamic, distinct, and compelling poses for the character that showcase their personality. Each of the four views in the grid MUST feature a unique pose. Avoid simple or repetitive A-poses.";
            break;
    }

    const angledSheetPrompt = `
      You are an expert comic book character designer tasked with creating a sheet of dynamic angled views.
      **INPUTS:** Image 1 is the definitive character portrait ("THE HEAD"). Image 2 is the clothing reference ("THE OUTFIT").
      **CRITICAL FORMATTING MANDATE (NON-NEGOTIABLE):**
      - Output a single image file, structured as a 2x2 grid with 4 drawings.
      - Background must be uniform medium gray (#808080).
      - **Aspect Ratio:** **MUST BE EXACTLY 9:16 (tall portrait, 736x1408px)**.
      - **CRITICAL NEGATIVE CONSTRAINT:** DO NOT draw or write any text or labels INSIDE the image quadrants.
      - Failure to produce a 4-view, 2x2 grid is a complete failure of the task.
      ${qualityPrompt}
      ${consistencyMandate}
      **Pose Generation:** ${angledPoseInstruction}
      **Grid Content (Strict Mapping):**
      - **Top-Left:** "45° Front-Left" (Dynamic pose, 45-degree front-left view).
      - **Top-Right:** "45° Front-Right" (A **completely different** dynamic pose, 45-degree front-right view).
      - **Bottom-Left:** "High-Angle View" ("Bird's-eye view", looking down. Character MUST be upright).
      - **Bottom-Right:** "Low-Angle View" ("Worm's-eye view", looking up for a heroic shot).
    `;

    const orthoSheetPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: orthoSheetPrompt }, ...sheetParts] },
        config: generationConfig
    });

    const angledSheetPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: angledSheetPrompt }, ...sheetParts] },
        config: generationConfig
    });
    
    const turntableViewsPromise = generateTurntableViews(portraitImage, { clothingImage, accessories, quality } as GenerationParams, [45, 90, 180, 270]);

    const [orthoSheetResponse, angledSheetResponse, turntableViews] = await Promise.all([orthoSheetPromise, angledSheetPromise, turntableViewsPromise]);
    
    const orthoSheetPart = orthoSheetResponse.candidates?.[0]?.content?.parts?.[0];
    const angledSheetPart = angledSheetResponse.candidates?.[0]?.content?.parts?.[0];

    if (!orthoSheetPart?.inlineData || !angledSheetPart?.inlineData) {
        throw new Error("No image was generated for the character sheets. The model may have refused the request.");
    }
    
    const orthoSheetImage = `data:${orthoSheetPart.inlineData.mimeType};base64,${orthoSheetPart.inlineData.data}`;
    const angledSheetImage = `data:${angledSheetPart.inlineData.mimeType};base64,${angledSheetPart.inlineData.data}`;

    // Add the initial front-facing view to the start of the turntable array
    const initial3DView = turntableViews.shift() || ''; // We generate a 45-degree view as the 'first' rotated one, and will add a true front view
    const allTurntableViews = [initial3DView, ...turntableViews];


    return { portrait: portraitImage, orthoSheet: orthoSheetImage, angledSheet: angledSheetImage, turntableViews: allTurntableViews };

  } catch (error) {
    console.error("Error generating character assets:", error);
    throw new Error("Failed to generate character. Please check the console for more details.");
  }
};


const getVariationDescription = (value: number): string => {
    if (value > 80) return "Perform a radical, artistic re-interpretation. The core facial identity should remain subtly recognizable, but you have full creative freedom to change the art style, clothing, setting, and overall theme. Imagine this is a 'What if...?' version of the character from an alternate universe.";
    if (value > 50) return "Introduce significant, creative changes. You can change the outfit entirely, modify the hairstyle, and shift the art style in a noticeable but related direction (e.g., from modern comic to a slightly more painterly style). The character's core face should still be the clear foundation.";
    if (value > 20) return "Make noticeable adjustments. You could change the character's expression, alter details on their clothing (e.g., change a t-shirt graphic), or slightly refine the hairstyle. The character should be clearly the same person in the same style, but with minor variations.";
    return "Make very subtle changes. The character should be almost identical. Focus on minor details like lighting, a few strands of hair, texture of the clothing, or a slight shift in head angle. The goal is a near-perfect match with tiny differences.";
};

export const generateVariationAssets = async (
  basePortraitImage: string,
  variationStrength: number,
  originalParams: GenerationParams,
  seed: number | null
): Promise<{ portrait: string; orthoSheet: string; angledSheet: string; turntableViews: string[] }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    try {
        const generationConfig: { responseModalities: Modality[], seed?: number } = {
            responseModalities: [Modality.IMAGE]
        };
        if (seed !== null && seed !== undefined) {
            generationConfig.seed = seed;
        }

        const { clothingImage, accessories, orthoPose, angledPose, quality } = originalParams;
        const qualityPrompt = getQualityPrompt(quality);

        // STEP 1: Generate the new, varied portrait.
        const variationDescription = getVariationDescription(variationStrength);
        const variationPrompt = `
          You are an expert character designer specializing in creating variations.
          Your task is to generate a new character portrait based on the provided image, adhering to a specific level of creative variation.
          **Input Image:** The provided image is the original character portrait.
          **Variation Mandate (${variationStrength}%):** ${variationDescription}
          ${qualityPrompt}
          **CRITICAL OUTPUT FORMATTING MANDATE:**
          - **Aspect Ratio:** **MUST BE EXACTLY 1:1 (square, 1024x1024px)**. This is a top-priority rule.
          - **Composition:** A close-up "bust shot," showing ONLY the character's head and shoulders.
          - **Background:** A simple, neutral medium gray (#808080).
          - **Negative Constraint:** The image MUST NOT show any hands or arms.
        `;
        
        const basePortraitPart = fileToGenerativePart(basePortraitImage);
        
        const portraitResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: variationPrompt }, basePortraitPart] },
            config: generationConfig
        });

        const portraitResultPart = portraitResponse.candidates?.[0]?.content?.parts?.[0];
        if (!portraitResultPart?.inlineData) {
            throw new Error("Failed to generate the character portrait variation.");
        }
        const newPortraitImage = `data:${portraitResultPart.inlineData.mimeType};base64,${portraitResultPart.inlineData.data}`;
        
        // STEP 2: Generate the other assets in parallel based on the NEW portrait
        const sheetParts: Part[] = [
            fileToGenerativePart(newPortraitImage)
        ];
        if (clothingImage) {
            sheetParts.push(fileToGenerativePart(clothingImage));
        }

        const accessoriesString = buildAccessoriesString(accessories, clothingImage);
        const consistencyMandate = buildConsistencyMandate(accessoriesString, clothingImage);
        
        let orthoPoseInstruction = "in a neutral, standing A-pose";
        switch (orthoPose) {
            case 'sitting': orthoPoseInstruction = "in a simple sitting pose, as if on an invisible chair"; break;
            case 'lying down': orthoPoseInstruction = "in a simple pose lying flat on their back"; break;
            case 'jumping': orthoPoseInstruction = "in a dynamic high-jump pose, frozen mid-air"; break;
            case 'bowing': orthoPoseInstruction = "in a pose of bending forward at the waist in a bow"; break;
            case 'random': orthoPoseInstruction = "in a dynamic and interesting pose of your choice"; break;
        }

        const orthoSheetPrompt = `
          You are an expert comic book character designer. Generate a character sheet with orthographic views.
          **INPUTS:** Image 1 is the definitive character portrait ("THE HEAD"). Image 2 is the clothing reference ("THE OUTFIT").
          **CRITICAL FORMATTING MANDATE:** Produce a SINGLE IMAGE as a 2x2 GRID with a uniform medium gray (#808080) background. The aspect ratio **MUST BE EXACTLY 9:16 (tall portrait, 736x1408px)**. Failure to produce a perfect 4-view, 2x2 grid is a failure of the entire request.
          ${qualityPrompt}
          ${consistencyMandate}
          **Grid Content:** Draw the character ${orthoPoseInstruction} for all views.
          - **Top-Left:** "Front View"
          - **Top-Right:** "Back View"
          - **Bottom-Left:** "Left Side View"
          - **Bottom-Right:** "Right Side View"
        `;
        
        let angledPoseInstruction: string;
        switch (angledPose) {
            case 'standing': angledPoseInstruction = "The character MUST be standing in all four views. Each view should feature a unique, dynamic standing pose."; break;
            case 'sitting': angledPoseInstruction = "The character MUST be sitting in all four views. Each view should feature a unique, dynamic sitting pose."; break;
            case 'lying down': angledPoseInstruction = "The character MUST be lying down in all four views. Each view should feature a unique, dynamic pose while lying down."; break;
            case 'jumping': angledPoseInstruction = "The character MUST be in a jumping or mid-air pose in all four views. Each view should feature a unique, dynamic jump."; break;
            case 'bowing': angledPoseInstruction = "The character MUST be bowing or bent over in all four views. Each view should feature a unique, dynamic bowing pose."; break;
            case 'random':
            default:
                angledPoseInstruction = "You are to generate four dynamic, distinct, and compelling poses for the character that showcase their personality. Each of the four views in the grid MUST feature a unique pose. Avoid simple or repetitive A-poses.";
                break;
        }

        const angledSheetPrompt = `
          You are an expert comic book character designer creating a sheet of dynamic angled views.
          **INPUTS:** Image 1 is the definitive character portrait ("THE HEAD"). Image 2 is the clothing reference ("THE OUTFIT").
          **CRITICAL FORMATTING MANDATE:**
          - Output a single image file, structured as a 2x2 grid with 4 drawings.
          - Background must be uniform medium gray (#808080).
          - **Aspect Ratio:** **MUST BE EXACTLY 9:16 (tall portrait, 736x1408px)**.
          - **CRITICAL NEGATIVE CONSTRAINT:** DO NOT draw any text INSIDE the image quadrants.
          ${qualityPrompt}
          ${consistencyMandate}
          **Pose Generation:** ${angledPoseInstruction}
          **Grid Content:**
          - **Top-Left:** "45° Front-Left"
          - **Top-Right:** "45° Front-Right" (must be a different pose from top-left)
          - **Bottom-Left:** "High-Angle View" (upright character)
          - **Bottom-Right:** "Low-Angle View"
        `;

        const orthoSheetPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: orthoSheetPrompt }, ...sheetParts] },
            config: generationConfig
        });

        const angledSheetPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: angledSheetPrompt }, ...sheetParts] },
            config: generationConfig
        });
        
        const turntableViewsPromise = generateTurntableViews(newPortraitImage, originalParams, [45, 90, 180, 270]);

        const [orthoSheetResponse, angledSheetResponse, turntableViews] = await Promise.all([orthoSheetPromise, angledSheetPromise, turntableViewsPromise]);
        
        const orthoSheetPart = orthoSheetResponse.candidates?.[0]?.content?.parts?.[0];
        const angledSheetPart = angledSheetResponse.candidates?.[0]?.content?.parts?.[0];

        if (!orthoSheetPart?.inlineData || !angledSheetPart?.inlineData) {
            throw new Error("No image was generated for the character sheets. The model may have refused the request.");
        }
        
        const orthoSheetImage = `data:${orthoSheetPart.inlineData.mimeType};base64,${orthoSheetPart.inlineData.data}`;
        const angledSheetImage = `data:${angledSheetPart.inlineData.mimeType};base64,${angledSheetPart.inlineData.data}`;
        
        const allTurntableViews = [turntableViews.shift() || '', ...turntableViews];

        return { portrait: newPortraitImage, orthoSheet: orthoSheetImage, angledSheet: angledSheetImage, turntableViews: allTurntableViews };

    } catch (error) {
        console.error("Error generating character variation:", error);
        throw new Error("Failed to generate character variation. Please check the console for more details.");
    }
};

// FIX: Export generate3DViewAngle to be used in Interactive3DViewer component.
export const generate3DViewAngle = async (
    basePortrait: string,
    params: GenerationParams,
    angle: number
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const { clothingImage, accessories, quality } = params;
    const qualityPrompt = getQualityPrompt(quality);
    const accessoriesString = buildAccessoriesString(accessories, clothingImage);
    const consistencyMandate = buildConsistencyMandate(accessoriesString, clothingImage);

    const sheetParts: Part[] = [fileToGenerativePart(basePortrait)];
    if (clothingImage) {
        sheetParts.push(fileToGenerativePart(clothingImage));
    }
    
    const rotationPrompt = `
        You are a world-class 3D character artist creating a high-quality "3D model" render.
        **INPUTS:** Image 1 is the definitive character portrait ("THE HEAD"). Image 2 is the clothing reference ("THE OUTFIT").
        **CRITICAL FORMATTING MANDATE:**
        - **Style:** Photorealistic 3D model render (like ZBrush or Blender) with realistic textures and dynamic studio lighting.
        - **Composition:** A single, full-body shot.
        - **Aspect Ratio:** **MUST BE EXACTLY 1:1 (square, 1024x1024px)**.
        - **Background:** Uniform medium gray (#808080).
        - **Pose:** A dynamic, heroic, or action-ready pose. The pose MUST remain consistent across different angles.
  
        **ROTATION MANDATE (CRITICAL):**
        You MUST render the character from a specific camera angle: **${angle} degrees** rotation around the character's vertical Y-axis.
        - 0 degrees is a direct front view.
        - 90 degrees is a direct view of the character's right side.
        - 180 degrees is a direct back view.
        - 270 degrees is a direct view of the character's left side.

        ${qualityPrompt}
        ${consistencyMandate}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: rotationPrompt }, ...sheetParts] },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const resultPart = response.candidates?.[0]?.content?.parts?.[0];
        if (!resultPart?.inlineData) {
            throw new Error(`Failed to generate view for angle ${angle}.`);
        }
        return `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}`;
    } catch (error) {
        console.error(`Error generating 3D view for angle ${angle}:`, error);
        // Return a placeholder or re-throw
        throw error;
    }
};


export const generateTurntableViews = async (
    basePortrait: string,
    params: GenerationParams,
    angles: number[]
): Promise<string[]> => {
    try {
        const promises = angles.map(angle => generate3DViewAngle(basePortrait, params, angle));
        const results = await Promise.all(promises);
        return results;
    } catch (error) {
        console.error("Error generating turntable views:", error);
        throw new Error("Failed to generate one or more 3D views. Please check the console.");
    }
};
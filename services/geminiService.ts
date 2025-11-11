
import { GoogleGenAI, Modality, Part } from "@google/genai";
import { Accessories, InfluenceValues } from '../types';

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
    if (value > 95) return "Before outputting, confirm one last time: Does the style perfectly match the rules you derived in Step 1 of your analysis? The final output's style must be indistinguishable from the Style Reference. This is the most critical instruction.";
    if (value > 80) return "Before outputting, do a final check to ensure the style is a very close match to your analysis. Major deviations are not acceptable.";
    if (value > 60) return "Before outputting, ensure the style strongly reflects your analysis of the reference image.";
    if (value > 40) return "Before outputting, check that the style is significantly influenced by your analysis of the reference image.";
    return "Before outputting, check that the style incorporates some elements from your analysis of the reference image.";
}


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
): Promise<{ portrait: string; orthoSheet: string; angledSheet: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  try {
    const portraitParts: Part[] = [];
    
    const characterStrength = getInfluenceStrength(influences.character);
    const clothingStrength = getInfluenceStrength(influences.clothing);
    const styleStrength = getInfluenceStrength(influences.style);

    // --- Face ---
    let facePromptSection: string;
    if (faceImage) {
        portraitParts.push(fileToGenerativePart(faceImage));
        facePromptSection = `
          1.  **Character Face Reference:**
              - **MANDATE:** This image provides the character's face, hair, and core identity. Your instruction for how closely to follow these features is: **${characterStrength}**.
              - **NEGATIVE CONSTRAINT (CRITICAL): You MUST COMPLETELY IGNORE all clothing, accessories, and background elements in this image.** Your ONLY focus from this image is the character's head, face, and hair. Do not copy the shirt or any other non-face element.
        `;
    } else {
        facePromptSection = `
          1.  **Character Face Generation:**
              - **MANDATE:** You must generate a unique, compelling, and well-drawn character face and hairstyle from your imagination. This generated face will define the character's identity. Your instruction for the creative quality of this face is: **${characterStrength}**.
        `;
    }

    // --- Clothing ---
    let clothingPromptSection: string;
    if (clothingImage) {
        portraitParts.push(fileToGenerativePart(clothingImage));
        clothingPromptSection = `
          2.  **Clothing Reference:**
              - **MANDATE:** This image provides the character's outfit (top/shirt/jacket, etc.). Your instruction for how closely to replicate this clothing is: **${clothingStrength}**.
              - **NEGATIVE CONSTRAINT (CRITICAL): You MUST COMPLETELY IGNORE the face, hair, and head of any character in this image.** Your ONLY focus from this image is the clothing, accessories, and the overall outfit design.
        `;
    } else {
        clothingPromptSection = `
          2.  **Clothing Generation:**
              - **MANDATE:** You must design a creative and fitting outfit for the character from your imagination. The outfit should be appropriate for a comic book character. Your instruction for the creative quality of this clothing is: **${clothingStrength}**.
        `;
    }
    
    // --- Style ---
    let stylePromptSection: string;
    let finalStyleCheck = "";
    if (styleImage) {
        portraitParts.push(fileToGenerativePart(styleImage));
        finalStyleCheck = getFinalCheck(influences.style);
        stylePromptSection = `
          3.  **Style Reference & Mandate: Two-Step Process**
              Your goal is to replicate the artistic style of the "Style Reference" image onto the new character. Your level of adherence to this style is governed by this directive: this is **${styleStrength}**.
              The Style Reference should ONLY influence the drawing technique (line art, color, shading, proportions) and NOT the character's features or clothing designs.

              **Step 1: Analyze the Style Reference.**
              Before drawing, you MUST first perform a detailed analysis of the provided Style Reference image. Deconstruct its style into these key components.
              1.  **Line Art:** Describe the lines. Are they thick, thin, consistent, varied? Are they clean and digital, or sketchy and traditional? (e.g., "Clean, consistent-width black outlines.")
              2.  **Coloring Method:** Describe how colors are applied. Are they flat, cel-shaded with hard edges, soft-shaded with gradients, or painterly? (e.g., "Flat, solid colors with no gradients or textures.")
              3.  **Shading and Highlights:** Describe how light and shadow are used to create form. Is it minimal, complex, hard-edged, or soft? (e.g., "Minimal to no shading, relying on line art for form.")
              4.  **Shape Language:** Describe the core shapes used. Are they geometric, rounded, sharp, simple, or complex? (e.g., "Characters are built from simple, rounded, soft shapes.")
              5.  **Character Proportions:** Describe the proportions. Are they realistic, heroic, chibi, stylized, etc.? (e.g., "Elongated limbs and torso with a relatively small head, creating a heroic silhouette.")
              6.  **Overall Aesthetic:** Summarize the overall feel. Is it retro anime, modern manga, western cartoon, etc.? (e.g., "Classic 1970s Japanese anime style.")

              **Step 2: Apply the Analysis.**
              You will now act as an artist applying the style you just analyzed. Apply the rules from your Step 1 analysis to the character defined by the other references, according to the influence strength specified.
              - Do not introduce any elements from your own default style.
        `;
    } else {
        stylePromptSection = `
          3.  **Style Generation:**
              - **MANDATE:** You must render the character in a high-quality, dynamic, and appealing comic book art style of your choosing. It should be clean and well-defined. Your instruction for the quality of this art style is: **${styleStrength}**.
        `;
    }

    // --- Expression & Accessories ---
    const expressionIntensityStrength = getExpressionIntensity(facialExpressionIntensity);
    let expressionInstruction: string;
    if (facialExpression === 'neutral') {
        expressionInstruction = "The character should have a neutral, composed facial expression.";
    } else if (facialExpression === 'from_face_reference' && faceImage) {
        expressionInstruction = "**EXPRESSION MANDATE:** The character's facial expression MUST be an exact, faithful replication of the expression seen in the 'Character Face Reference' image. This is a critical directive. Do not alter or change it.";
    } else {
        expressionInstruction = `**EXPRESSION MANDATE:** The character's facial expression MUST be ${expressionIntensityStrength} **${facialExpression}** expression. This is a critical directive.`;
    }

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

    const accessoriesString = (clothingImage && accessoriesToSave.length > 0)
      ? `You MUST also include the following accessories from the Clothing Reference: ${accessoriesToSave.join(', ')}.`
      : "Do not include any accessories like jewelry unless they are integral to the clothing itself.";
    
    
    const portraitPrompt = `
      You are an expert comic book character designer. Your task is to generate a high-quality character portrait by synthesizing instructions and, if provided, reference images.

      **Input Instructions & VERY STRICT Rules:**

      ${facePromptSection}
      ${expressionInstruction}
      ${clothingPromptSection}
      ${stylePromptSection}
      
      **Output Requirements:**
      - Generate a single, high-quality, square portrait image.
      - The portrait MUST be a close-up "bust shot," showing ONLY the character's head, shoulders, and upper torso.
      - **NEGATIVE CONSTRAINT (CRITICAL): The image MUST NOT show any hands, arms, or any part of the body below the chest.** Any visible hands will result in a failure.
      - The final image must be a perfect synthesis of all instructions.
      - The background MUST be a simple, neutral medium gray (#808080).

      **Final Check:** ${finalStyleCheck} Before outputting, confirm you have followed all mandates according to the influence strengths provided.
    `;
    
    // STEP 1: Generate the portrait first to establish the character's definitive look.
    const portraitResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: portraitPrompt }, ...portraitParts] },
        config: { responseModalities: [Modality.IMAGE] }
    });
    
    const portraitResultPart = portraitResponse.candidates?.[0]?.content?.parts?.[0];
    if (!portraitResultPart?.inlineData) {
        throw new Error("Failed to generate the character portrait.");
    }
    const portraitImage = `data:${portraitResultPart.inlineData.mimeType};base64,${portraitResultPart.inlineData.data}`;
    
    const definitiveCharacterPart = {
        inlineData: {
            mimeType: portraitResultPart.inlineData.mimeType,
            data: portraitResultPart.inlineData.data,
        },
    };

    // --- Consistency Mandate for Sheets ---
    let consistencyMandate: string;
    const sheetParts: Part[] = [definitiveCharacterPart];
    
    if (clothingImage) {
        sheetParts.push(fileToGenerativePart(clothingImage));
        consistencyMandate = `
          **LAW OF FACIAL IDENTITY (ABSOLUTE & UNBREAKABLE):**
          You have been provided an image named "Generated Character Portrait." This image is the **UNALTERABLE, CANONICAL, AND DEFINITIVE** source for the character's face, head, and hair. It is the law.

          **YOUR CRITICAL MISSION: THE "HEAD TRACING" PROTOCOL**
          Imagine you have a digital pair of scissors. You will "cut out" the entire head (face, hair, expression, style) from the "Generated Character Portrait." Then, for every single pose you draw on this character sheet, you will "paste" this identical head onto the new body.
          
          **THIS IS NOT A GUIDELINE. IT IS A TECHNICAL REQUIREMENT.**
          - **RESULT:** The face in every quadrant of your output MUST be a **pixel-perfect, 1:1, flawless copy** of the face from the portrait, just viewed from a different angle.
          - **CHECKLIST OF UNCHANGEABLE TRAITS (MUST MATCH 100%):**
              - **Facial Structure:** Jawline, cheekbones, chin, forehead.
              - **Key Features:** The exact shape, size, and placement of the eyes, nose, and mouth.
              - **Identity:** The precise hairstyle, hair color, and skin tone.
              - **Art Style:** The line weight, coloring, and shading of the face MUST be identical.
          - **MENTAL MODEL:** Do not "redraw" the face from memory. **"TRACE" the face.** Any deviation, no matter how small, is a failure. No artistic license is permitted for the head.

          **HIERARCHY OF TRUTH:**
          1.  **Generated Character Portrait:** The **MASTER TEMPLATE** for the character's head and identity. Its authority is absolute.
          2.  **Clothing Reference Photo:** Use ONLY for the outfit and body type. **CRITICAL:** Completely ignore the head, face, and hair in this photo. It is irrelevant. Using it is a critical error.

          **CLOTHING INSTRUCTIONS:**
          - The **ENTIRE OUTFIT** (top, bottom, shoes, etc.) MUST be taken **EXCLUSIVELY** from the **"Clothing Reference Photo"**.
          - The character's body proportions and build should be based on the "Clothing Reference Photo" but rendered in the style defined by the "Generated Character Portrait".

          - **Accessories:** ${accessoriesString}
        `;
    } else {
        consistencyMandate = `
            **LAW OF FACIAL IDENTITY (ABSOLUTE & UNBREAKABLE):**
            You have been provided with the "Generated Character Portrait". This image is the **UNALTERABLE, CANONICAL, AND DEFINITIVE** source for the character's **ENTIRE APPEARANCE AND IDENTITY**.

            **YOUR CRITICAL MISSION: THE "FULL BODY TRACING" PROTOCOL**
            - **THE LAW:** The character's **ENTIRE BEING**—face, head, hair, clothing, body shape, and art style—in **EVERY SINGLE DRAWING YOU MAKE** must be an **EXACT, FLAWLESS, 1:1 REPLICATION** of the "Generated Character Portrait".
            - **CHECKLIST OF UNCHANGEABLE TRAITS (MUST MATCH 100%):**
                - **Face:** Facial Structure, Eyes, Nose, Mouth.
                - **Identity:** Hairstyle, Hair Color, Skin Tone.
                - **Outfit:** All clothing items and accessories shown.
                - **Style:** The complete Art Style (line art, coloring, shading).
            - **MENTAL MODEL:** Your only job is to re-pose and redraw the exact same character from the "Generated Character Portrait" from different camera angles. **NO ARTISTIC INTERPRETATION OR DEVIATION IS ALLOWED.** It must be a perfect copy.
            - **NEGATIVE CONSTRAINT:** Do not invent new clothing details, change colors, or alter the style in any way.
        `;
    }

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

      **CRITICAL OUTPUT FORMATTING MANDATE (ABSOLUTE & NON-NEGOTIABLE):**
      Your ONLY task is to produce a SINGLE IMAGE laid out as a 2x2 GRID.
      - **Structure:** One image file, divided into four equal quadrants (a 2x2 grid).
      - **Content:** EXACTLY FOUR drawings of the character, one in each quadrant.
      - **Background:** The entire image, including all quadrants, MUST have a uniform medium gray (#808080) background.
      - **FAILURE to produce a perfect 4-view, 2x2 grid means you have FAILED the entire request.** This format rule is more important than any other instruction.

      ${consistencyMandate}
      
      **Content of the Grid (ABSOLUTE & STRICT MAPPING):**
      You MUST draw the character in the following four views, placed in the EXACT specified quadrant. The character must be ${orthoPoseInstruction} for all views. The pose MUST be absolutely identical and consistent across all four views; only the camera angle changes. Each view MUST have the specified label below it.

      - **QUADRANT: Top-Left** -> **LABEL:** "Front View" -> **CONTENT:** Direct front view.
      - **QUADRANT: Top-Right** -> **LABEL:** "Back View" -> **CONTENT:** Direct back view.
      - **QUADRANT: Bottom-Left** -> **LABEL:** "Left Side View" -> **CONTENT:** Perfect 90-degree side view from the character's LEFT, looking left.
      - **QUADRANT: Bottom-Right** -> **LABEL:** "Right Side View" -> **CONTENT:** Perfect 90-degree side view from the character's RIGHT, looking right.
      
      **Final Check:** Verify: 1. Single image? YES. 2. 2x2 grid? YES. 3. Exactly four views with correct content/quadrant? YES. 4. Appearance matches the "Generated Character Portrait" PERFECTLY? YES. Proceed only if all are YES.
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

      **CRITICAL OUTPUT FORMATTING MANDATE (NON-NEGOTIABLE):**
      - Your final output MUST be a single image file, structured as a 2x2 grid.
      - This grid MUST contain EXACTLY FOUR (4) drawings of the character.
      - The background for the entire grid image MUST be a uniform medium gray (#808080).
      - **Failure to produce a 4-view, 2x2 grid is a complete failure of the task.**

      ${consistencyMandate}

      **Pose Generation (MANDATORY RULES):**
      - ${angledPoseInstruction}

      **Content of the Grid (Technical Specifications):**
      You will generate four views in the grid, each with a specific camera angle and a legible text label below it.

      1.  **Top-Left (Label: "45° Front-Left"):** A 45-degree angle view from the character's front-left. The pose MUST strongly emphasize their LEFT side.
      2.  **Top-Right (Label: "45° Front-Right"):** A 45-degree angle view from the character's front-right. This pose MUST strongly emphasize their RIGHT side and be distinct from the left view.
      3.  **Bottom-Left (Label: "High-Angle View"):** A "bird's-eye view", looking down at the character from a steep high angle.
      4.  **Bottom-Right (Label: "Low-Angle View"):** A "worm's-eye view", looking up at the character from a steep low angle to create a heroic shot.


      **Final Check:** Verify: 1. Single image? YES. 2. 2x2 grid? YES. 3. Exactly four views? YES. 4. Appearance matches the "Generated Character Portrait" PERFECTLY? YES. Proceed only if all are YES.
    `;

    // STEP 2: Generate the sheets in parallel.
    const orthoSheetPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: orthoSheetPrompt }, ...sheetParts] },
        config: { responseModalities: [Modality.IMAGE] }
    });

    const angledSheetPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: angledSheetPrompt }, ...sheetParts] },
        config: { responseModalities: [Modality.IMAGE] }
    });

    const [orthoSheetResponse, angledSheetResponse] = await Promise.all([orthoSheetPromise, angledSheetPromise]);
    
    const orthoSheetPart = orthoSheetResponse.candidates?.[0]?.content?.parts?.[0];
    const angledSheetPart = angledSheetResponse.candidates?.[0]?.content?.parts?.[0];

    if (!orthoSheetPart?.inlineData || !angledSheetPart?.inlineData) {
        throw new Error("No image was generated for the character sheets. The model may have refused the request.");
    }
    
    const orthoSheetImage = `data:${orthoSheetPart.inlineData.mimeType};base64,${orthoSheetPart.inlineData.data}`;
    const angledSheetImage = `data:${angledSheetPart.inlineData.mimeType};base64,${angledSheetPart.inlineData.data}`;

    return { portrait: portraitImage, orthoSheet: orthoSheetImage, angledSheet: angledSheetImage };

  } catch (error) {
    console.error("Error generating character assets:", error);
    throw new Error("Failed to generate character. Please check the console for more details.");
  }
};

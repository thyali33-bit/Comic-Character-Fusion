import { GoogleGenAI, Modality, Part } from "@google/genai";
import { SavedFeatures, InfluenceValues } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
    if (value > 95) return "an absolute and strict mandate";
    if (value > 80) return "a primary and critical directive";
    if (value > 60) return "a strong and heavily prioritized guideline";
    if (value > 40) return "a significant factor";
    if (value > 20) return "a moderate suggestion";
    return "a minor source of inspiration";
};

const getFinalCheck = (value: number): string => {
    if (value > 95) return "Before outputting, confirm one last time: Does the style perfectly match the rules you derived in Step 1 of your analysis? The final output's style must be indistinguishable from the Style Reference. This is the most critical instruction.";
    if (value > 80) return "Before outputting, do a final check to ensure the style is a very close match to your analysis. Major deviations are not acceptable.";
    if (value > 60) return "Before outputting, ensure the style strongly reflects your analysis of the reference image.";
    if (value > 40) return "Before outputting, check that the style is significantly influenced by your analysis of the reference image.";
    return "Before outputting, check that the style incorporates some elements from your analysis of the reference image.";
}


export const generateCharacterAssets = async (
  characterImage: string,
  styleImage: string,
  features: SavedFeatures,
  influences: InfluenceValues,
  orthoPose: string,
  angledPose: string,
): Promise<{ portrait: string; orthoSheet: string; angledSheet: string }> => {
  try {
    const characterPart = fileToGenerativePart(characterImage);
    const stylePart = fileToGenerativePart(styleImage);

    const featuresToSave = Object.entries(features)
      .filter(([, value]) => value)
      .map(([key]) => {
        if (key === 'facialExpressions') return 'the facial expressions';
        if (key === 'clothes') return 'the clothing style and colors';
        if (key === 'bodyShape') return 'the body shape';
        return '';
      })
      .filter(Boolean);

    const featuresString = featuresToSave.length > 0
      ? featuresToSave.join(', ')
      : "the character's overall design and appearance";
    
    const characterStrength = getInfluenceStrength(influences.character);
    const styleStrength = getInfluenceStrength(influences.style);
    const finalStyleCheck = getFinalCheck(influences.style);

    const styleMandate = `
      **Style Replication Directive: Two-Step Process**
      Your goal is to replicate the artistic style of the "Style Reference" image onto the new character. Your level of adherence to this style is governed by this directive: this is **${styleStrength}**.
      Follow this two-step process to understand and apply the style.

      **Step 1: Analyze the Style Reference.**
      Before drawing, you MUST first perform a detailed analysis of the provided Style Reference image. Deconstruct its style into these key components.
      1.  **Line Art:** Describe the lines. Are they thick, thin, consistent, varied? Are they clean and digital, or sketchy and traditional? (e.g., "Clean, consistent-width black outlines.")
      2.  **Coloring Method:** Describe how colors are applied. Are they flat, cel-shaded with hard edges, soft-shaded with gradients, or painterly? (e.g., "Flat, solid colors with no gradients or textures.")
      3.  **Shading and Highlights:** Describe how light and shadow are used to create form. Is it minimal, complex, hard-edged, or soft? (e.g., "Minimal to no shading, relying on line art for form.")
      4.  **Shape Language:** Describe the core shapes used for characters. Are they geometric, rounded, sharp, simple, or complex? (e.g., "Characters are built from simple, rounded, soft shapes.")
      5.  **Overall Aesthetic:** Summarize the overall feel. Is it retro anime, modern manga, western cartoon, etc.? (e.g., "Classic 1970s Japanese anime style.")

      **Step 2: Apply the Analysis.**
      You will now act as an artist applying the style you just analyzed. Apply the rules from your Step 1 analysis to the Character Base and Pose Reference, according to the influence strength specified.
      - The analysis from Step 1 is your primary guide for the style.
      - Do not introduce any elements from your own default style.
    `;
    
    const portraitPrompt = `
      You are an expert comic book character designer. Your task is to generate a high-quality character portrait based on a character reference and a style reference.

      1. **Character Base Reference:** This image provides the character's core identity. Your instruction for how closely to follow it is: **${characterStrength}**. You MUST consider the following specific features from it: ${featuresString}. The portrait should capture the essence of this character.

      2. **Style Reference & Mandate:**
      ${styleMandate}

      **Output Requirements:**
      - Generate a single, high-quality, square portrait image.
      - The portrait should be a close-up, focusing on the character's face and upper torso (a "bust shot").
      - The character should have a compelling and expressive facial expression that fits their identity.
      - The background MUST be a simple, neutral medium gray (#808080).

      **Final Check:** ${finalStyleCheck}
    `;
    
    // STEP 1: Generate the portrait first to establish the character's definitive look.
    const portraitResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: portraitPrompt }, characterPart, stylePart] },
        config: { responseModalities: [Modality.IMAGE] }
    });
    
    const portraitResultPart = portraitResponse.candidates?.[0]?.content?.parts?.[0];
    if (!portraitResultPart?.inlineData) {
        throw new Error("Failed to generate the character portrait.");
    }
    const portraitImage = `data:${portraitResultPart.inlineData.mimeType};base64,${portraitResultPart.inlineData.data}`;
    
    // The generated portrait now becomes a new input part for consistency.
    const definitiveCharacterPart = {
        inlineData: {
            mimeType: portraitResultPart.inlineData.mimeType,
            data: portraitResultPart.inlineData.data,
        },
    };

    const consistencyMandate = `
      **CRITICAL CONSISTENCY INSTRUCTION:**
      You have been provided with multiple reference images:
      1.  "Original Character Photo": The initial photo reference.
      2.  "Generated Character Portrait": The definitive, stylized look of the character's head.
      3.  "Style Reference": The target art style.
      
      **YOUR TASK:**
      - **Face, Hair, and Style:** You MUST draw the character's head, hair, and overall artistic style to *perfectly match* the "Generated Character Portrait". This is the absolute ground truth for their stylized appearance. Replicate it with 100% fidelity.
      - **Clothing, Colors, and Body Shape:** For the full body, you MUST refer back to the **"Original Character Photo"**. The clothing (including the exact colors of the shirt and pants, and the type of shoes) and the character's body shape MUST be replicated accurately from this original photo. Render these elements in the final art style defined by the "Generated Character Portrait".
      - Do not invent new clothing or change colors. The colors from the original photo are mandatory.
    `;

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

      **CRITICAL OUTPUT FORMATTING MANDATE:**
      Your single most important task is the format of the output.
      - **THE ONLY VALID OUTPUT IS A SINGLE IMAGE ORGANIZED AS A 2X2 GRID.**
      - **THIS GRID MUST CONTAIN EXACTLY FOUR (4) CHARACTER VIEWS. NOT THREE, NOT SIX, NOT EIGHT. EXACTLY FOUR.** This rule is absolute and non-negotiable.
      - The entire background of the single composite image MUST be a simple, neutral medium gray (#808080).
      - DO NOT generate more than four views. DO NOT generate individual images.

      ${consistencyMandate}
      
      **Content of the Grid (Technical Specifications):**
      You must generate the following four views. The character must be ${orthoPoseInstruction} for all views. The pose MUST be absolutely identical and consistent across all four views; only the camera angle changes. Each view should have a clean, legible text label below it. The perspective rules are ABSOLUTE.

      1.  **Top-Left (Label: "Front View"):**
          - A direct, flat, head-on view.
          - The character is looking directly at the camera.
          - There is no rotation or perspective. It is a completely flat front view.

      2.  **Top-Right (Label: "Back View"):**
          - A direct, flat view of the character's back.
          - The back of the head, shoulders, and body are facing the camera.
          - There is no rotation or perspective.

      3.  **Bottom-Left (Label: "Left Profile"):**
          - **RULE:** This is a perfect 90-degree side view from the character's left. IT IS NOT A 3/4 VIEW.
          - To be perfectly clear: Imagine the character is holding their pose, and a camera is placed exactly at their left side, looking directly at them. The character does not turn their head or body toward the camera at all. You are drawing what that camera sees.
          - The character is looking directly towards the left edge of the image (relative to their own orientation).
          - The viewer can only see the left side of the character's face (left eye, left ear) and body (left arm, left leg).
          - **NEGATIVE CONSTRAINT:** The right side of the character (right eye, right shoulder, right arm, right leg) MUST BE 100% HIDDEN FROM VIEW. Do not show any part of the far side of the character.

      4.  **Bottom-Right (Label: "Right Profile"):**
          - **RULE:** This is a perfect 90-degree side view from the character's right. IT IS NOT A 3/4 VIEW.
          - To be perfectly clear: Imagine the character is holding their pose, and a camera is placed exactly at their right side, looking directly at them. The character does not turn their head or body toward the camera at all. You are drawing what that camera sees.
          - The character is looking directly towards the right edge of the image (relative to their own orientation).
          - The viewer can only see the right side of the character's face (right eye, right ear) and body (right arm, right leg).
          - **NEGATIVE CONSTRAINT:** The left side of the character (left eye, left shoulder, left arm, left leg) MUST BE 100% HIDDEN FROM VIEW. Do not show any part of the far side of the character.
      
      **Final Check:** ${finalStyleCheck}
    `;
    
    let angledPoseInstruction: string;
    switch (angledPose) {
        case 'standing':
            angledPoseInstruction = "The character MUST be standing in all four views. Each view should feature a unique, dynamic standing pose (e.g., heroic stance, relaxed standing, ready for action).";
            break;
        case 'sitting':
            angledPoseInstruction = "The character MUST be sitting in all four views. Each view should feature a unique, dynamic sitting pose (e.g., sitting on an invisible ledge, crouching, sitting cross-legged).";
            break;
        case 'lying down':
            angledPoseInstruction = "The character MUST be lying down in all four views. Each view should feature a unique, dynamic pose while lying down (e.g., resting, knocked down, sleeping).";
            break;
        case 'jumping':
            angledPoseInstruction = "The character MUST be in a jumping or mid-air pose in all four views. Each view should feature a unique, dynamic jump (e.g., leaping, kicking, hovering).";
            break;
        case 'bowing':
            angledPoseInstruction = "The character MUST be bowing or bent over in all four views. Each view should feature a unique, dynamic bowing pose (e.g., a respectful bow, dodging, picking something up).";
            break;
        case 'random':
        default:
            angledPoseInstruction = "You are to generate four dynamic, distinct, and compelling poses for the character that showcase their personality. Each of the four views in the grid MUST feature a unique pose. Avoid simple or repetitive A-poses or T-poses. The poses should be thematically appropriate for a comic book character. Think action stances, heroic postures, or contemplative moments. The goal is to make the character sheet look dynamic and alive.";
            break;
    }

    const angledSheetPrompt = `
      You are an expert comic book character designer tasked with creating a sheet of dynamic angled views.

      **CRITICAL OUTPUT FORMATTING MANDATE:**
      Your single most important task is the format of the output.
      - **THE ONLY VALID OUTPUT IS A SINGLE IMAGE ORGANIZED AS A 2X2 GRID.**
      - **THIS GRID MUST CONTAIN EXACTLY FOUR (4) CHARACTER VIEWS. NOT THREE, NOT SIX, NOT EIGHT. EXACTLY FOUR.** This rule is absolute and non-negotiable.
      - The entire background of the single composite image MUST be a simple, neutral medium gray (#808080).
      - DO NOT generate more than four views. DO NOT generate individual images.

      ${consistencyMandate}

      **Pose Generation (MANDATORY RULES):**
      - ${angledPoseInstruction}

      **Content of the Grid:**
      Place the following four views in the grid, each with a clean, legible text label below it:
      1.  **Top-Left (Label: "45° Front-Left"):** The character viewed from a 45-degree angle from their front-left. The viewer sees the front but also more of the left side.
      2.  **Top-Right (Label: "45° Front-Right"):** A mirror of the top-left view. The character viewed from a 45-degree angle from their front-right.
      3.  **Bottom-Left (Label: "High-Angle View"):** A dramatic high-angle shot (bird's-eye view), looking down at the character at a 45-degree angle.
      4.  **Bottom-Right (Label: "Low-Angle View"):** A dramatic low-angle "hero shot", looking up from significantly below the character. Emphasize perspective (feet larger, head smaller).

      **Final Check:** ${finalStyleCheck}
    `;

    // STEP 2: Generate the sheets in parallel, using the portrait for consistency.
    const orthoSheetPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
            { text: orthoSheetPrompt }, 
            characterPart, // Original for clothes/body
            definitiveCharacterPart, // Generated portrait for definitive look
            stylePart 
        ] },
        config: { responseModalities: [Modality.IMAGE] }
    });

    const angledSheetPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [
            { text: angledSheetPrompt }, 
            characterPart, // Original for clothes/body
            definitiveCharacterPart, // Generated portrait for definitive look
            stylePart
        ] },
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
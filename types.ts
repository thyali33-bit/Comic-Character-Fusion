
export interface Accessories {
  bracelets: boolean;
  necklaces: boolean;
  earrings: boolean;
  eyeglasses: boolean;
}

export interface InfluenceValues {
  character: number;
  clothing: number;
  style: number;
}

export type BackgroundType = 'simple' | 'solid' | 'scene';

export type ExpressionIntensity = 'low' | 'medium' | 'high';

export interface OrthoViews {
    front: string | null;
    side: string | null;
    back: string | null;
}

export interface GenerationParams {
  faceImage: string | null;
  clothingImage: string | null;
  artStyle: string;
  artStylePrompt: string;
  isBlackAndWhite: boolean;
  accessories: Accessories;
  influences: InfluenceValues;
  orthoPose: string;
  angledPose: string;
  facialExpression: string;
  facialExpressionIntensity: ExpressionIntensity;
  prompt: string;
  quality: string;
  threeDActionPrompt: string;
  primaryColor: string;
  secondaryColor: string;
  enableColorOverride: boolean;
  backgroundType: BackgroundType;
  backgroundColor: string;
  backgroundPrompt: string;
}

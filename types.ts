
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

export interface GenerationParams {
  faceImage: string | null;
  styleImage: string | null;
  clothingImage: string | null;
  accessories: Accessories;
  influences: InfluenceValues;
  orthoPose: string;
  angledPose: string;
  facialExpression: string;
  facialExpressionIntensity: number;
  prompt: string;
  quality: string;
  threeDActionPrompt: string;
  primaryColor: string;
  secondaryColor: string;
  enableColorOverride: boolean;
}

export interface Preset {
  id: string;
  name: string;
  timestamp: number;
  config: Omit<GenerationParams, 'faceImage' | 'styleImage' | 'clothingImage'>;
}
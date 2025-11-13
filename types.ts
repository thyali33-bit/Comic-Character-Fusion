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
  seed: number | null;
  quality: string;
}

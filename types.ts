
export interface PSDLayer {
  name: string;
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
  opacity: number;
  canvas?: HTMLCanvasElement;
  children?: PSDLayer[];
}

export interface AtlasRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalX: number;
  originalY: number;
  uv: {
    u1: number;
    v1: number;
    u2: number;
    v2: number;
  };
}

export interface ProcessingStatus {
  step: string;
  progress: number;
  isComplete: boolean;
  error?: string;
}

export enum CoordinateSystem {
  TOP_LEFT = 'TOP_LEFT',
  BOTTOM_LEFT = 'BOTTOM_LEFT'
}

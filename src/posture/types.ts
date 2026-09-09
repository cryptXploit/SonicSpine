export interface PostureFeatures {
  /** Angle of the line connecting left and right shoulder in degrees. 0 is perfectly level. */
  shoulderRoll: number;
  
  /** Angle of the line connecting left and right ear in degrees. 0 is perfectly level. */
  headTilt: number;
  
  /** Relative Z depth difference between the head and the shoulders. Negative values typically mean the head is closer to the camera. */
  neckForwardDepth: number;
  
  /** Normalized 2D Euclidean distance between left and right shoulders. Useful as a scale reference. */
  shoulderWidth: number;
}

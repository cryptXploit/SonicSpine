export interface PostureFeatures {
  /** Angle of the line connecting left and right shoulder in degrees. 0 is perfectly level. */
  shoulderRoll: number;
  
  /** Angle of the line connecting left and right ear in degrees. 0 is perfectly level. */
  headTilt: number;
  
  /** Relative scale between head and shoulders to determine forward lean */
  forwardCraneRatio: number;
  
  /** Distance from ears to shoulders, normalized by shoulder width */
  neckCollapseRatio: number;

  /** Absolute deviation of nose from center of ears, to detect head turn */
  noseYawDeviation: number;
}

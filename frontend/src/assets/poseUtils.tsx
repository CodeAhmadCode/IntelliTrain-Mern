import * as posenet from '@tensorflow-models/posenet';
import type { Keypoint } from '@tensorflow-models/posenet';

export const drawKeypoints = (
  keypoints: Keypoint[],
  minConfidence: number,
  ctx: CanvasRenderingContext2D
) => {
  keypoints.forEach((keypoint) => {
    if (keypoint.score >= minConfidence) {
      ctx.beginPath();
      ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
    }
  });
};

export const drawSkeleton = (
  keypoints: Keypoint[],
  minConfidence: number,
  ctx: CanvasRenderingContext2D
) => {
  // Notice: getAdjacentKeyPoints is a named export on the imported `posenet` object.
  const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
    keypoints,
    minConfidence
  );

  adjacentKeyPoints.forEach(([first, second]) => {
    ctx.beginPath();
    ctx.moveTo(first.position.x, first.position.y);
    ctx.lineTo(second.position.x, second.position.y);
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
};

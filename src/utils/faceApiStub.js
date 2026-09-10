const noopLoad = async () => Promise.resolve();

export const nets = {
  tinyFaceDetector: { loadFromUri: noopLoad },
  faceExpressionNet: { loadFromUri: noopLoad },
  faceLandmark68Net: { loadFromUri: noopLoad }
};

export class TinyFaceDetectorOptions {
  constructor(opts = {}) {
    this.inputSize = opts.inputSize || 416;
    this.scoreThreshold = opts.scoreThreshold || 0.5;
  }
}

export function detectAllFaces() {
  return {
    withFaceLandmarks() {
      return this;
    },
    withFaceExpressions: async function () {
      return [];
    }
  };
}

const faceApiStub = {
  nets,
  TinyFaceDetectorOptions,
  detectAllFaces
};

export default faceApiStub;
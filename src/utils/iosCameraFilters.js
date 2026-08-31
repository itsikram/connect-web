/**
 * iOS Camera / Photos filter catalog (iOS 13+ swipe filters).
 * Parameters feed a WebGL shader that approximates Core Image recipes:
 * CIVibrance, CIToneCurve, CITemperatureAndTint, CIPhotoEffectMono/Tonal/Noir.
 */

export const IOS_FILTERS = [
  {
    id: "original",
    label: "Original",
    params: identityParams(),
  },
  {
    id: "vivid",
    label: "Vivid",
    params: {
      vibrance: 0.4,
      contrast: 0.17,
      brightness: 0.035,
      saturation: 1.1,
      temperature: 0.05,
      tint: 0.0,
      crush: 0.008,
      lift: 0.028,
      clarity: 0.16,
      vignette: 0.03,
      grain: 0.0,
      grayMode: 0,
      vividMode: 1,
      greenBoost: 0.38,
      skinSoft: 0.32,
    },
  },
  {
    id: "vividWarm",
    label: "Vivid Warm",
    params: {
      vibrance: 0.34,
      contrast: 0.2,
      brightness: 0.03,
      saturation: 1.06,
      temperature: 0.3,
      tint: 0.07,
      crush: 0.02,
      lift: 0.02,
      clarity: 0.07,
      vignette: 0.04,
      grain: 0.0,
      grayMode: 0,
    },
  },
  {
    id: "vividCool",
    label: "Vivid Cool",
    params: {
      vibrance: 0.36,
      contrast: 0.2,
      brightness: 0.02,
      saturation: 1.05,
      temperature: -0.28,
      tint: -0.04,
      crush: 0.015,
      lift: 0.01,
      clarity: 0.07,
      vignette: 0.05,
      grain: 0.0,
      grayMode: 0,
    },
  },
  {
    id: "dramatic",
    label: "Dramatic",
    params: {
      vibrance: 0.14,
      contrast: 0.44,
      brightness: 0.01,
      saturation: 0.88,
      temperature: 0.04,
      tint: 0.02,
      crush: 0.12,
      lift: 0.02,
      clarity: 0.24,
      vignette: 0.14,
      grain: 0.015,
      grayMode: 0,
    },
  },
  {
    id: "dramaticWarm",
    label: "Dramatic Warm",
    params: {
      vibrance: 0.12,
      contrast: 0.42,
      brightness: 0.015,
      saturation: 0.9,
      temperature: 0.26,
      tint: 0.06,
      crush: 0.11,
      lift: 0.025,
      clarity: 0.22,
      vignette: 0.13,
      grain: 0.012,
      grayMode: 0,
    },
  },
  {
    id: "dramaticCool",
    label: "Dramatic Cool",
    params: {
      vibrance: 0.13,
      contrast: 0.43,
      brightness: 0.005,
      saturation: 0.86,
      temperature: -0.26,
      tint: -0.03,
      crush: 0.13,
      lift: 0.015,
      clarity: 0.22,
      vignette: 0.15,
      grain: 0.012,
      grayMode: 0,
    },
  },
  {
    id: "mono",
    label: "Mono",
    params: {
      vibrance: 0.0,
      contrast: 0.2,
      brightness: 0.01,
      saturation: 0.0,
      temperature: -0.06,
      tint: 0.0,
      crush: 0.05,
      lift: 0.02,
      clarity: 0.06,
      vignette: 0.08,
      grain: 0.02,
      grayMode: 1,
    },
  },
  {
    id: "silvertone",
    label: "Silvertone",
    params: {
      vibrance: 0.0,
      contrast: 0.08,
      brightness: 0.045,
      saturation: 0.0,
      temperature: -0.08,
      tint: 0.02,
      crush: 0.0,
      lift: 0.14,
      clarity: 0.02,
      vignette: 0.05,
      grain: 0.01,
      grayMode: 2,
    },
  },
  {
    id: "noir",
    label: "Noir",
    params: {
      vibrance: 0.0,
      contrast: 0.54,
      brightness: -0.01,
      saturation: 0.0,
      temperature: -0.04,
      tint: 0.0,
      crush: 0.2,
      lift: 0.0,
      clarity: 0.12,
      vignette: 0.22,
      grain: 0.07,
      grayMode: 3,
    },
  },
];

export const DEFAULT_FILTER_ID = "original";

function identityParams() {
  return {
    vibrance: 0,
    contrast: 0,
    brightness: 0,
    saturation: 1,
    temperature: 0,
    tint: 0,
    crush: 0,
    lift: 0,
    clarity: 0,
    vignette: 0,
    grain: 0,
    grayMode: 0,
    vividMode: 0,
    greenBoost: 0,
    skinSoft: 0,
  };
}

export function getFilterById(id) {
  return IOS_FILTERS.find((f) => f.id === id) || IOS_FILTERS[0];
}

export function getFilterIndex(id) {
  const i = IOS_FILTERS.findIndex((f) => f.id === id);
  return i < 0 ? 0 : i;
}

export function adjacentFilterId(id, delta) {
  const i = getFilterIndex(id);
  const next = (i + delta + IOS_FILTERS.length) % IOS_FILTERS.length;
  return IOS_FILTERS[next].id;
}

export function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

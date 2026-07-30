#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation";

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  "..",
);
const ASSET_ROOT = path.join(PROJECT_ROOT, "public", "assets");
const REQUIRED_BONES = [
  "hips",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "rightUpperArm",
  "rightLowerArm",
  "leftUpperLeg",
  "leftLowerLeg",
  "rightUpperLeg",
  "rightLowerLeg",
];

async function loadAnimation(filePath) {
  const bytes = fs.readFileSync(filePath);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buffer, "", resolve, reject);
  });
  const animation = gltf.userData.vrmAnimations?.[0];
  if (!animation) throw new Error("missing VRMC_vrm_animation data");
  return animation;
}

function quaternionAngle(values) {
  const quaternion = new THREE.Quaternion().fromArray(values).normalize();
  return 2 * Math.acos(Math.min(1, Math.abs(quaternion.w)));
}

export function armPoseEnergy(animation, time) {
  let energy = 0;
  for (const bone of ["leftUpperArm", "rightUpperArm"]) {
    const track = animation.humanoidTracks.rotation.get(bone);
    if (!track) return 0;
    energy += quaternionAngle(track.createInterpolant().evaluate(time));
  }
  return energy;
}

export function motionRange(animation) {
  let largest = 0;
  for (const track of animation.humanoidTracks.rotation.values()) {
    const first = new THREE.Quaternion()
      .fromArray(track.values, 0)
      .normalize();
    for (let frame = 1; frame < track.times.length; frame += 1) {
      const current = new THREE.Quaternion()
        .fromArray(track.values, frame * 4)
        .normalize();
      largest = Math.max(
        largest,
        2 * Math.acos(Math.min(1, Math.abs(first.dot(current)))),
      );
    }
  }
  return largest;
}

export async function validateMotionFile(filePath) {
  const animation = await loadAnimation(filePath);
  const missingBones = REQUIRED_BONES.filter(
    (bone) => !animation.humanoidTracks.rotation.has(bone),
  );
  if (missingBones.length > 0) {
    throw new Error(`missing humanoid bones: ${missingBones.join(", ")}`);
  }
  if (animation.duration < 0.2 || animation.duration > 8) {
    throw new Error(`duration ${animation.duration.toFixed(2)}s is outside 0.2-8s`);
  }
  let minimumArmEnergy = Number.POSITIVE_INFINITY;
  for (let sample = 0; sample <= 60; sample += 1) {
    minimumArmEnergy = Math.min(
      minimumArmEnergy,
      armPoseEnergy(animation, (animation.duration * sample) / 60),
    );
  }
  if (minimumArmEnergy < 0.7) {
    throw new Error(
      `contains a T-pose-like frame (arm energy ${minimumArmEnergy.toFixed(2)}rad)`,
    );
  }
  const range = motionRange(animation);
  if (range < 0.025) {
    throw new Error(`motion range ${range.toFixed(3)}rad is effectively static`);
  }
  return {
    duration: animation.duration,
    minimumArmEnergy,
    range,
  };
}

async function main() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ASSET_ROOT, "manifest.json"), "utf8"),
  );
  const animationAssets = manifest.assets.filter(
    (asset) => asset.role === "animation",
  );
  const failures = [];
  for (const asset of animationAssets) {
    const filePath = path.join(ASSET_ROOT, asset.path);
    try {
      const result = await validateMotionFile(filePath);
      console.log(
        `${asset.path}: ${result.duration.toFixed(2)}s, arm floor ${result.minimumArmEnergy.toFixed(2)}rad, range ${result.range.toFixed(2)}rad`,
      );
    } catch (error) {
      failures.push(`${asset.path}: ${error.message}`);
    }
  }
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`${animationAssets.length} motion assets passed.`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}

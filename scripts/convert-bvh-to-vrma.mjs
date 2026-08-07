#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  cleanMotionClip,
  MOTION_CLEANUP_PROFILES,
  motionJerkMetrics,
} from "./motion-cleanup.mjs";

class FileReaderPolyfill {
  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      })
      .catch((error) => this.onerror?.(error));
  }

  readAsDataURL(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        const type = blob.type || "application/octet-stream";
        this.result = `data:${type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      })
      .catch((error) => this.onerror?.(error));
  }
}

globalThis.FileReader ??= FileReaderPolyfill;

const VRM_BONES = [
  ["hips", ["Hips"]],
  ["spine", ["Spine"]],
  ["chest", ["Spine1", "Chest"]],
  ["upperChest", ["Spine2", "UpperChest"]],
  ["neck", ["Neck"]],
  ["head", ["Head"]],
  ["leftShoulder", ["LeftShoulder"]],
  ["leftUpperArm", ["LeftArm", "LeftUpperArm"]],
  ["leftLowerArm", ["LeftForeArm", "LeftLowerArm"]],
  ["leftHand", ["LeftHand"]],
  ["rightShoulder", ["RightShoulder"]],
  ["rightUpperArm", ["RightArm", "RightUpperArm"]],
  ["rightLowerArm", ["RightForeArm", "RightLowerArm"]],
  ["rightHand", ["RightHand"]],
  ["leftUpperLeg", ["LeftUpLeg", "LeftUpperLeg"]],
  ["leftLowerLeg", ["LeftLeg", "LeftLowerLeg"]],
  ["leftFoot", ["LeftFoot"]],
  ["leftToes", ["LeftToeBase", "LeftToes"]],
  ["rightUpperLeg", ["RightUpLeg", "RightUpperLeg"]],
  ["rightLowerLeg", ["RightLeg", "RightLowerLeg"]],
  ["rightFoot", ["RightFoot"]],
  ["rightToes", ["RightToeBase", "RightToes"]],
];

class VRMAnimationExporterPlugin {
  constructor(writer) {
    this.writer = writer;
    this.name = "VRMC_vrm_animation";
  }

  afterParse(input) {
    const root = Array.isArray(input) ? input[0] : input;
    const boneMap = root?.userData?.vrmBoneMap;
    if (!boneMap) return;

    const humanBones = {};
    for (const [vrmName, bone] of boneMap) {
      const node = this.writer.nodeMap.get(bone);
      if (node != null) humanBones[vrmName] = { node };
    }

    const gltf = this.writer.json;
    gltf.extensionsUsed ??= [];
    if (!gltf.extensionsUsed.includes(this.name)) {
      gltf.extensionsUsed.push(this.name);
    }
    gltf.extensions ??= {};
    gltf.extensions[this.name] = {
      specVersion: "1.0",
      humanoid: { humanBones },
    };
  }
}

function findBone(root, candidates) {
  for (const candidate of candidates) {
    const bone = root.getObjectByName(candidate);
    if (bone) return bone;
  }
  return null;
}

function detectScale(root) {
  const head = findBone(root, ["Head"]);
  const hips = findBone(root, ["Hips"]);
  if (!head || !hips) return 1;
  root.updateWorldMatrix(true, true);
  const height = Math.abs(
    head.getWorldPosition(new THREE.Vector3()).y -
      hips.getWorldPosition(new THREE.Vector3()).y,
  );
  return height > 10 ? 0.01 : 1;
}

export function trimAndRetimeClip(
  clip,
  { start = 0, end = clip.duration, speed = 1 } = {},
) {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error("Animation speed must be greater than zero.");
  }
  const clipStart = Math.max(0, Math.min(start, clip.duration));
  const clipEnd = Math.max(clipStart, Math.min(end, clip.duration));
  if (clipEnd - clipStart < 0.05) {
    throw new Error("Trimmed animation must be at least 0.05 seconds long.");
  }
  const tracks = clip.tracks.map((track) => {
    const valueSize = track.getValueSize();
    const selectedTimes = [
      clipStart,
      ...track.times.filter(
        (time) => time > clipStart && time < clipEnd,
      ),
      clipEnd,
    ];
    const interpolant = track.createInterpolant();
    const values = new Float32Array(selectedTimes.length * valueSize);
    selectedTimes.forEach((time, index) => {
      values.set(interpolant.evaluate(time), index * valueSize);
    });
    const times = Float32Array.from(
      selectedTimes,
      (time) => (time - clipStart) / speed,
    );
    return new track.constructor(track.name, times, values);
  });
  return new THREE.AnimationClip(
    clip.name,
    (clipEnd - clipStart) / speed,
    tracks,
  );
}

export function normalizeBvhHipsPosition(track) {
  const originX = track.values[0];
  const originY = track.values[1];
  const originZ = track.values[2];
  for (let index = 0; index < track.values.length; index += 3) {
    track.values[index] = THREE.MathUtils.clamp(
      track.values[index] - originX,
      -0.3,
      0.3,
    );
    track.values[index + 1] = THREE.MathUtils.clamp(
      track.values[index + 1] - originY,
      -0.18,
      0.18,
    );
    track.values[index + 2] = THREE.MathUtils.clamp(
      track.values[index + 2] - originZ,
      -0.3,
      0.3,
    );
  }
  return originY;
}

async function convert(
  sourcePath,
  outputPath,
  profileName = "natural",
  trimOptions = {},
) {
  const cleanupProfile = MOTION_CLEANUP_PROFILES[profileName];
  if (!cleanupProfile) {
    throw new Error(
      `Unknown cleanup profile "${profileName}". Use responsive, natural, or tight.`,
    );
  }
  const parsed = new BVHLoader().parse(fs.readFileSync(sourcePath, "utf8"));
  const root = parsed.skeleton.bones[0];
  const scale = detectScale(root);

  if (scale !== 1) {
    root.traverse((object) => {
      if (object.isBone) object.position.multiplyScalar(scale);
    });
  }

  const boneMap = new Map();
  for (const [vrmName, candidates] of VRM_BONES) {
    const bone = findBone(root, candidates);
    if (bone) boneMap.set(vrmName, bone);
  }
  if (!boneMap.has("hips") || !boneMap.has("head")) {
    throw new Error("BVH does not contain a recognizable humanoid skeleton.");
  }
  root.userData.vrmBoneMap = boneMap;

  const selectedClip = trimAndRetimeClip(parsed.clip, trimOptions);
  const beforeCleanup = motionJerkMetrics(selectedClip);
  const clip = cleanMotionClip(selectedClip, cleanupProfile);
  const afterCleanup = motionJerkMetrics(clip);
  clip.name = path.basename(outputPath, path.extname(outputPath));
  clip.tracks = clip.tracks.filter(
    (track) => track.name === "Hips.position" || track.name.endsWith(".quaternion"),
  );
  if (scale !== 1) {
    for (const track of clip.tracks) {
      if (track.name === "Hips.position") {
        for (let index = 0; index < track.values.length; index += 1) {
          track.values[index] *= scale;
        }
      }
    }
  }
  const hipsPosition = clip.tracks.find(
    (track) => track.name === "Hips.position",
  );
  if (hipsPosition) {
    const originY = normalizeBvhHipsPosition(hipsPosition);
    root.position.set(0, originY, 0);
  }

  const exporter = new GLTFExporter();
  exporter.register((writer) => new VRMAnimationExporterPlugin(writer));
  const output = await exporter.parseAsync(root, {
    animations: [clip],
    binary: true,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(output));
  console.log(
    `${path.basename(sourcePath)} -> ${path.basename(outputPath)} (${clip.duration.toFixed(2)}s, ${boneMap.size} mapped bones, ${profileName} cleanup, jerk p95 ${beforeCleanup.angularJerkP95.toFixed(1)} -> ${afterCleanup.angularJerkP95.toFixed(1)} rad/s²)`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  function takeNumberFlag(name, fallback) {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    const value = Number(args[index + 1]);
    args.splice(index, 2);
    return value;
  }
  const profileFlag = args.indexOf("--profile");
  let profile = "natural";
  if (profileFlag !== -1) {
    profile = args[profileFlag + 1];
    args.splice(profileFlag, 2);
  }
  const start = takeNumberFlag("--start", 0);
  const end = takeNumberFlag("--end", Number.POSITIVE_INFINITY);
  const speed = takeNumberFlag("--speed", 1);
  const [source, output] = args;
  if (!source || !output) {
    console.error(
      "Usage: node scripts/convert-bvh-to-vrma.mjs SOURCE.bvh OUTPUT.vrma [--profile responsive|natural|tight] [--start 0] [--end SECONDS] [--speed 1.15]",
    );
    process.exit(1);
  }

  convert(path.resolve(source), path.resolve(output), profile, {
    end,
    speed,
    start,
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

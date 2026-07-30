#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

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
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};

const VRM_BONES = [
  ["hips", ["pelvis", "Hips"]],
  ["spine", ["spine_01", "Spine"]],
  ["chest", ["spine_02", "Chest", "Spine1"]],
  ["upperChest", ["spine_03", "UpperChest", "Spine2"]],
  ["neck", ["neck_01", "Neck"]],
  ["head", ["Head", "head"]],
  ["leftShoulder", ["clavicle_l", "LeftShoulder"]],
  ["leftUpperArm", ["upperarm_l", "LeftArm", "LeftUpperArm"]],
  ["leftLowerArm", ["lowerarm_l", "LeftForeArm", "LeftLowerArm"]],
  ["leftHand", ["hand_l", "LeftHand"]],
  ["rightShoulder", ["clavicle_r", "RightShoulder"]],
  ["rightUpperArm", ["upperarm_r", "RightArm", "RightUpperArm"]],
  ["rightLowerArm", ["lowerarm_r", "RightForeArm", "RightLowerArm"]],
  ["rightHand", ["hand_r", "RightHand"]],
  ["leftUpperLeg", ["thigh_l", "LeftUpLeg", "LeftUpperLeg"]],
  ["leftLowerLeg", ["calf_l", "LeftLeg", "LeftLowerLeg"]],
  ["leftFoot", ["foot_l", "LeftFoot"]],
  ["leftToes", ["ball_l", "LeftToeBase", "LeftToes"]],
  ["rightUpperLeg", ["thigh_r", "RightUpLeg", "RightUpperLeg"]],
  ["rightLowerLeg", ["calf_r", "RightLeg", "RightLowerLeg"]],
  ["rightFoot", ["foot_r", "RightFoot"]],
  ["rightToes", ["ball_r", "RightToeBase", "RightToes"]],
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

function readGlb(sourcePath) {
  const bytes = fs.readFileSync(sourcePath);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buffer, "", resolve, reject);
  });
}

export function retimeClip(clip, speed = 1) {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error("Animation speed must be greater than zero.");
  }
  const output = clip.clone();
  for (const track of output.tracks) {
    track.times = Float32Array.from(track.times, (time) => time / speed);
  }
  output.duration = clip.duration / speed;
  return output;
}

function normalizeHipsPosition(clip, hipsName) {
  const track = clip.tracks.find(
    (candidate) => candidate.name === `${hipsName}.position`,
  );
  if (!track) return;
  const originX = track.values[0];
  const originZ = track.values[2];
  for (let index = 0; index < track.values.length; index += 3) {
    track.values[index] = THREE.MathUtils.clamp(
      track.values[index] - originX,
      -0.35,
      0.35,
    );
    track.values[index + 2] = THREE.MathUtils.clamp(
      track.values[index + 2] - originZ,
      -0.35,
      0.35,
    );
  }
}

async function convert(sourcePath, clipName, outputPath, speed) {
  const gltf = await readGlb(sourcePath);
  const sourceClip = gltf.animations.find(
    (candidate) => candidate.name === clipName,
  );
  if (!sourceClip) {
    const names = gltf.animations.map((clip) => clip.name).join(", ");
    throw new Error(`Animation "${clipName}" was not found. Available: ${names}`);
  }

  const skeletonRoot =
    gltf.scene.getObjectByName("root") ??
    gltf.scene.getObjectByName("Root") ??
    findBone(gltf.scene, VRM_BONES[0][1])?.parent;
  if (!skeletonRoot) throw new Error("GLB has no recognizable skeleton root.");

  const boneMap = new Map();
  for (const [vrmName, candidates] of VRM_BONES) {
    const bone = findBone(skeletonRoot, candidates);
    if (bone) boneMap.set(vrmName, bone);
  }
  if (!boneMap.has("hips") || !boneMap.has("head")) {
    throw new Error("GLB does not contain a recognizable humanoid skeleton.");
  }
  skeletonRoot.userData.vrmBoneMap = boneMap;

  const allowedNames = new Set([...boneMap.values()].map((bone) => bone.name));
  const hipsName = boneMap.get("hips").name;
  const clip = retimeClip(sourceClip, speed);
  clip.name = path.basename(outputPath, path.extname(outputPath));
  clip.tracks = clip.tracks.filter((track) => {
    const separator = track.name.lastIndexOf(".");
    const nodeName = track.name.slice(0, separator);
    const property = track.name.slice(separator + 1);
    return (
      allowedNames.has(nodeName) &&
      (property === "quaternion" ||
        (nodeName === hipsName && property === "position"))
    );
  });
  normalizeHipsPosition(clip, hipsName);

  const exporter = new GLTFExporter();
  exporter.register((writer) => new VRMAnimationExporterPlugin(writer));
  const output = await exporter.parseAsync(skeletonRoot, {
    animations: [clip],
    binary: true,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(output));
  console.log(
    `${path.basename(sourcePath)}:${clipName} -> ${path.basename(outputPath)} (${clip.duration.toFixed(2)}s, ${boneMap.size} mapped bones, ${speed.toFixed(2)}x)`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  const speedFlag = args.indexOf("--speed");
  let speed = 1;
  if (speedFlag !== -1) {
    speed = Number(args[speedFlag + 1]);
    args.splice(speedFlag, 2);
  }
  const [source, clipName, output] = args;
  if (!source || !clipName || !output) {
    console.error(
      "Usage: node scripts/convert-glb-to-vrma.mjs SOURCE.glb CLIP_NAME OUTPUT.vrma [--speed 1.15]",
    );
    process.exit(1);
  }

  convert(
    path.resolve(source),
    clipName,
    path.resolve(output),
    speed,
  ).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

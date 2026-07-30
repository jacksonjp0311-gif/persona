#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Vector3 } from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
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
    head.getWorldPosition(new Vector3()).y - hips.getWorldPosition(new Vector3()).y,
  );
  return height > 10 ? 0.01 : 1;
}

async function convert(sourcePath, outputPath) {
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

  const clip = parsed.clip.clone();
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
    const originX = hipsPosition.values[0];
    const originY = hipsPosition.values[1];
    const originZ = hipsPosition.values[2];
    root.position.set(0, originY, 0);
    for (let index = 0; index < hipsPosition.values.length; index += 3) {
      hipsPosition.values[index] = Math.max(
        -0.3,
        Math.min(0.3, hipsPosition.values[index] - originX),
      );
      hipsPosition.values[index + 1] =
        originY + (hipsPosition.values[index + 1] - originY);
      hipsPosition.values[index + 2] = Math.max(
        -0.3,
        Math.min(0.3, hipsPosition.values[index + 2] - originZ),
      );
    }
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
    `${path.basename(sourcePath)} -> ${path.basename(outputPath)} (${clip.duration.toFixed(2)}s, ${boneMap.size} mapped bones)`,
  );
}

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  console.error("Usage: node scripts/convert-bvh-to-vrma.mjs SOURCE.bvh OUTPUT.vrma");
  process.exit(1);
}

convert(path.resolve(source), path.resolve(output)).catch((error) => {
  console.error(error);
  process.exit(1);
});

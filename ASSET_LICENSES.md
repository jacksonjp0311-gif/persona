# Persona asset licenses

The MIT license covers Persona's application source. It does not grant rights
to the VRM or VRMA files under `public/assets/`.

## Bundled environment

Persona includes the `dawn.exr` environment from `@pmndrs/assets`. The asset
collection is published under CC0 1.0 and sources its HDR environments from
Poly Haven.

## Space-XR motion captures

The following VRMA files are adaptations of BVH motion captures made by the
Space-XR team at IMPA VISGRAF Lab and published under Creative Commons
Attribution-ShareAlike 4.0 International:

- `space-xr-indian-dance.vrma`, `space-xr-pop-dance.vrma`,
  `space-xr-wave-dance.vrma`, `space-xr-accent-pop-long.vrma`,
  `space-xr-soft-step-long.vrma`, `space-xr-line-step-long.vrma`,
  `space-xr-street-flow-long.vrma`, `space-xr-turn-groove-long.vrma`, and
  `space-xr-power-freestyle-long.vrma`: performances by Thaisa Martins and
  Space-XR collaborators.

Source collection: https://visgraflab.impa.br/dance/?p=1

License: https://creativecommons.org/licenses/by-sa/4.0/

Persona selected self-contained motion phrases, converted the original BVH
skeleton and keyframes to the VRM Animation format, mapped the source humanoid
bones to VRM humanoid bone names, constrained desktop root travel, smoothed
capture noise, and changed the container format to binary glTF. These adapted
animation files remain licensed under CC BY-SA 4.0.

## Quaternius Universal Animation Library

Persona includes adapted clips from Quaternius' Universal Animation Library 1
and 2. Both source packs are released under Creative Commons Zero 1.0 and may
be used in personal and commercial projects.

Sources:

- https://quaternius.itch.io/universal-animation-library
- https://quaternius.itch.io/universal-animation-library-2

Persona extracted selected authored clips, retimed them for short desktop
emotes, mapped the source humanoid rig to VRM humanoid bone names, normalized
root travel, and converted the container to VRM Animation binary glTF.

## Local development media

VRM character files and unverified local motion inputs are intentionally
ignored by Git. Verified motion adaptations may be force-added with their
manifest provenance. Any local files without a verified redistribution license
are development inputs only. Therefore:

- do not publish unverified files in a source repository;
- do not attach a package containing them to a release;
- do not represent the MIT license as covering them; and
- do not set `distributionAllowed` to `true` for these files.

The automated release gate enforces the last two requirements, but repository
authors remain responsible for not committing restricted files.

`public/assets/library.json.example` and
`public/assets/manifest.json.example` describe the current ignored local test
files for development. They do not grant distribution rights; the example
manifest intentionally leaves distribution disabled and license provenance
incomplete.

## Replacing assets

Declare the packaged media and its product metadata in
`public/assets/library.json`. Then mirror every declared media path in
`public/assets/manifest.json`:

1. Set each asset's `license` to its SPDX identifier or clear license name.
2. Set each asset's `source` to a public source or author-provided provenance.
3. Confirm the license permits redistribution in this application.
4. Set `distributionAllowed` to `true`.
5. Run `npm run assets:release`.

If an asset requires attribution, add the complete attribution to this file
before release.

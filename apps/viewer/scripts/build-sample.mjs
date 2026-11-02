// Builds public/models/material-showcase.glb: a row of spheres, one per glTF PBR extension,
// so the viewer has a file that exercises clearcoat, transmission, sheen, iridescence, etc.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsAnisotropy, KHRMaterialsClearcoat, KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsIridescence, KHRMaterialsSheen, KHRMaterialsTransmission, KHRMaterialsVolume } from '@gltf-transform/extensions';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('Showcase');

const ext = {
  clearcoat: doc.createExtension(KHRMaterialsClearcoat),
  transmission: doc.createExtension(KHRMaterialsTransmission),
  volume: doc.createExtension(KHRMaterialsVolume),
  ior: doc.createExtension(KHRMaterialsIOR),
  sheen: doc.createExtension(KHRMaterialsSheen),
  iridescence: doc.createExtension(KHRMaterialsIridescence),
  anisotropy: doc.createExtension(KHRMaterialsAnisotropy),
  emissive: doc.createExtension(KHRMaterialsEmissiveStrength),
};

/** UV sphere with tangents (anisotropy needs a stable tangent frame). */
function sphere(radius, seg = 64, rings = 48) {
  const pos = [], nrm = [], uv = [], tan = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings, phi = v * Math.PI;
    for (let s = 0; s <= seg; s++) {
      const u = s / seg, theta = u * Math.PI * 2;
      const x = -Math.cos(theta) * Math.sin(phi), y = Math.cos(phi), z = Math.sin(theta) * Math.sin(phi);
      pos.push(x * radius, y * radius, z * radius);
      nrm.push(x, y, z);
      uv.push(u, v);
      tan.push(Math.sin(theta), 0, Math.cos(theta), 1);
    }
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const attrs = {
    POSITION: acc('VEC3', new Float32Array(pos)),
    NORMAL: acc('VEC3', new Float32Array(nrm)),
    TEXCOORD_0: acc('VEC2', new Float32Array(uv)),
    TANGENT: acc('VEC4', new Float32Array(tan)),
  };
  const indices = acc('SCALAR', new Uint16Array(idx));
  // every sphere reuses the same accessors; only the material differs
  return () => {
    const prim = doc.createPrimitive().setIndices(indices);
    for (const [k, a] of Object.entries(attrs)) prim.setAttribute(k, a);
    return prim;
  };
}

const presets = [
  ['Polished gold', (m) => m.setBaseColorFactor([1, 0.766, 0.336, 1]).setMetallicFactor(1).setRoughnessFactor(0.12)],
  ['Brushed steel', (m) => m.setBaseColorFactor([0.8, 0.8, 0.82, 1]).setMetallicFactor(1).setRoughnessFactor(0.35)
    .setExtension('KHR_materials_anisotropy', ext.anisotropy.createAnisotropy().setAnisotropyStrength(0.8))],
  ['Car paint', (m) => m.setBaseColorFactor([0.55, 0.02, 0.03, 1]).setMetallicFactor(0.4).setRoughnessFactor(0.45)
    .setExtension('KHR_materials_clearcoat', ext.clearcoat.createClearcoat().setClearcoatFactor(1).setClearcoatRoughnessFactor(0.03))],
  ['Glass', (m) => m.setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0)
    .setExtension('KHR_materials_transmission', ext.transmission.createTransmission().setTransmissionFactor(1))
    .setExtension('KHR_materials_volume', ext.volume.createVolume().setThicknessFactor(0.5).setAttenuationColor([0.85, 0.95, 1]).setAttenuationDistance(1))
    .setExtension('KHR_materials_ior', ext.ior.createIOR().setIOR(1.5))],
  ['Velvet', (m) => m.setBaseColorFactor([0.12, 0.03, 0.2, 1]).setMetallicFactor(0).setRoughnessFactor(0.9)
    .setExtension('KHR_materials_sheen', ext.sheen.createSheen().setSheenColorFactor([0.8, 0.5, 1]).setSheenRoughnessFactor(0.4))],
  ['Soap film', (m) => m.setBaseColorFactor([0.05, 0.05, 0.05, 1]).setMetallicFactor(1).setRoughnessFactor(0.15)
    .setExtension('KHR_materials_iridescence', ext.iridescence.createIridescence().setIridescenceFactor(1).setIridescenceIOR(1.3)
      .setIridescenceThicknessMinimum(250).setIridescenceThicknessMaximum(600))],
  ['Matte ceramic', (m) => m.setBaseColorFactor([0.85, 0.82, 0.76, 1]).setMetallicFactor(0).setRoughnessFactor(0.6)],
  ['Neon', (m) => m.setBaseColorFactor([0.02, 0.02, 0.02, 1]).setEmissiveFactor([0.1, 0.9, 1])
    .setExtension('KHR_materials_emissive_strength', ext.emissive.createEmissiveStrength().setEmissiveStrength(4))],
];

const R = 0.4, GAP = 1;
const newSphere = sphere(R);
presets.forEach(([name, apply], i) => {
  const mat = apply(doc.createMaterial(name));
  const mesh = doc.createMesh(name).addPrimitive(newSphere().setMaterial(mat));
  const col = i % 4, row = Math.floor(i / 4);
  scene.addChild(doc.createNode(name).setMesh(mesh).setTranslation([(col - 1.5) * GAP, R, (row - 0.5) * GAP]));
});

const out = join(dirname(fileURLToPath(import.meta.url)), '../public/models/material-showcase.glb');
await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(out, doc);
console.log('wrote', out);

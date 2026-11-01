"""
Builds the elevator car interior in Blender, bakes ambient occlusion and exports
one GLB + AO atlas per car size into apps/web/public/models/cabin/.

    npm run models -w @alaman/web            (Blender + compression, see build-models.mjs)
    blender -b --factory-startup -P apps/web/blender/build_cabin.py -- [--sizes 630,1000] [--samples 160]

The web app swaps materials by name and toggles variant nodes by name, so names here
are part of the contract with src/components/configurator/cabin3d/ModelCabin.tsx:

  materials  wall, floor, ceiling, steel, door, handrail, seam, light, glass, crystal, display, touch, btn_ring, dark
  variants   back_panels, glass_back, door_center, door_side, ceil_led, ceil_spots, ceil_backlit,
             ceil_crystal, handrail_back, handrail_sides, cop_buttons, cop_touch, btn_00..btn_19,
             extra_<name>

Geometry is authored in web coordinates (x right, y up, z toward the door) and converted
to Blender's Z-up on creation; the glTF exporter converts back.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "models", "cabin"))
RAW = os.path.join(HERE, ".out")  # uncompressed GLBs; build-models.mjs compresses them into OUT

# Inner car sizes (m) per rated load. Keep in sync with SIZES in cabin3d/look.ts.
SIZES = {
    "320": (1.0, 1.1),
    "450": (1.0, 1.25),
    "630": (1.1, 1.4),
    "800": (1.35, 1.4),
    "1000": (1.6, 1.4),
    "1600": (1.4, 2.4),
}

H = 2.25  # car height
T = 0.02  # wall panel thickness
GAP = 0.006  # seam between panels
BEVEL = 0.0025
ATLAS = 2048

NO_AO = {"light", "glass", "crystal", "display", "touch", "btn_ring"}


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = {"sizes": list(SIZES), "samples": 160}
    for i, a in enumerate(argv):
        if a == "--sizes":
            out["sizes"] = argv[i + 1].split(",")
        if a == "--samples":
            out["samples"] = int(argv[i + 1])
    return out


def bl(x, y, z):
    """web (x, y-up, z-toward-door) -> Blender (x, -z, y)"""
    return Vector((x, -z, y))


# ---------------------------------------------------------------- scene state


class Builder:
    def __init__(self):
        self.mats = {}
        self.groups = {}
        self.objects = []

    def mat(self, name):
        if name not in self.mats:
            m = bpy.data.materials.new(name)
            m.use_nodes = True
            self.mats[name] = m
        return self.mats[name]

    def group(self, name):
        if name not in self.groups:
            empty = bpy.data.objects.new(name, None)
            bpy.context.scene.collection.objects.link(empty)
            self.groups[name] = empty
        return self.groups[name]

    def add(self, name, bm, mat, group=None, uv_normalized=False, smooth=False):
        mesh = bpy.data.meshes.new(name)
        uv_world(bm, uv_normalized)
        for f in bm.faces:
            f.smooth = smooth
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(self.mat(mat))
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if group:
            obj.parent = self.group(group)
        obj["mat"] = mat
        obj["grp"] = group or "core"
        self.objects.append(obj)
        return obj

    # ---------- primitives (all sizes/positions in web coordinates)

    def box(self, name, size, pos, mat, group=None, bevel=BEVEL, uv_normalized=False, drop=()):
        """drop: web directions ('+x', '-y', ...) whose faces can never be seen from inside the car."""
        sx, sy, sz = size
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            # unit cube in Blender axes: x = width, y = depth, z = height
            v.co = Vector((v.co.x * sx, v.co.y * sz, v.co.z * sy))
            v.co += bl(*pos)
        if bevel and min(size) > bevel * 2.5:
            bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
        if drop:
            dirs = [bl(*{"+x": (1, 0, 0), "-x": (-1, 0, 0), "+y": (0, 1, 0), "-y": (0, -1, 0), "+z": (0, 0, 1), "-z": (0, 0, -1)}[d]) for d in drop]
            bm.normal_update()
            dead = [f for f in bm.faces if any(f.normal.dot(d) > 0.99 for d in dirs)]
            bmesh.ops.delete(bm, geom=dead, context="FACES")
        return self.add(name, bm, mat, group, uv_normalized)

    def plane(self, name, size, pos, mat, facing, group=None):
        """Thin quad facing +x/-x/+y/-y/+z/-z (web axes), UV 0..1."""
        w, h = size
        bm = bmesh.new()
        axes = {
            "+z": (Vector((1, 0, 0)), Vector((0, 1, 0))),
            "-z": (Vector((-1, 0, 0)), Vector((0, 1, 0))),
            "+x": (Vector((0, 0, -1)), Vector((0, 1, 0))),
            "-x": (Vector((0, 0, 1)), Vector((0, 1, 0))),
            "-y": (Vector((1, 0, 0)), Vector((0, 0, 1))),
            "+y": (Vector((1, 0, 0)), Vector((0, 0, -1))),
        }
        u, v = axes[facing]
        c = Vector(pos)
        corners = [c - u * w / 2 - v * h / 2, c + u * w / 2 - v * h / 2, c + u * w / 2 + v * h / 2, c - u * w / 2 + v * h / 2]
        verts = [bm.verts.new(bl(*p)) for p in corners]
        bm.faces.new(verts)
        return self.add(name, bm, mat, group, uv_normalized=True)

    def cylinder(self, name, radius, length, pos, axis, mat, group=None, segs=24, bevel=0.0, bevel_segs=2):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius, radius2=radius, depth=length)
        if bevel:
            caps = [e for e in bm.edges if all(abs(abs(v.co.z) - length / 2) < 1e-6 for v in e.verts)]
            bmesh.ops.bevel(bm, geom=caps, offset=bevel, segments=bevel_segs, profile=0.5, affect="EDGES", clamp_overlap=True)
        # created along Blender Z; rotate to requested web axis
        rot = {"y": None, "x": ("Y", math.pi / 2), "z": ("X", math.pi / 2)}[axis]
        if rot:
            from mathutils import Matrix

            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rot[1], 3, rot[0]))
        for v in bm.verts:
            v.co += bl(*pos)
        for f in bm.faces:
            f.smooth = True
        obj = self.add(name, bm, mat, group, smooth=True)
        mark_sharp(obj, 40)
        return obj


def mark_sharp(obj, angle_deg):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle() > math.radians(angle_deg):
            e.smooth = False
    bm.to_mesh(obj.data)
    bm.free()


def uv_world(bm, normalized):
    """UV0: planar projection in meters along the dominant normal axis (or 0..1 when normalized)."""
    layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        coords = []
        for loop in f.loops:
            p = loop.vert.co
            if ax == 0:
                uv = (-p.y if n.x > 0 else p.y, p.z)
            elif ax == 1:
                uv = (p.x if n.y > 0 else -p.x, p.z)
            else:
                uv = (p.x, p.y)
            coords.append(uv)
        if normalized:
            us = [c[0] for c in coords]
            vs = [c[1] for c in coords]
            du = (max(us) - min(us)) or 1
            dv = (max(vs) - min(vs)) or 1
            coords = [((u - min(us)) / du, (v - min(vs)) / dv) for u, v in coords]
        for loop, uv in zip(f.loops, coords):
            loop[layer].uv = uv


# ---------------------------------------------------------------- the car


def build(W, D):
    b = Builder()

    # shell
    b.box("floor", (W + 0.04, 0.03, D + 0.04), (0, -0.015, 0), "floor", bevel=0, drop=("+x", "-x", "-y", "+z", "-z"))
    b.box("ceiling", (W + 0.04, 0.03, D + 0.04), (0, H + 0.015, 0), "ceiling", bevel=0, drop=("+x", "-x", "+y", "+z", "-z"))
    b.plane("seam_back", (W, H), (0, H / 2, -D / 2), "seam", "+z")
    b.plane("seam_left", (D, H), (-W / 2, H / 2, 0), "seam", "+x")
    b.plane("seam_right", (D, H), (W / 2, H / 2, 0), "seam", "-x")

    def panels(length, place, group, prefix, back):
        n = max(2, round(length / 0.42))
        pw = (length - GAP * (n + 1)) / n
        for i in range(n):
            c = -length / 2 + GAP + pw / 2 + i * (pw + GAP)
            size, pos = place(c, pw)
            b.box(f"{prefix}_{i}", size, pos, "wall", group, drop=(back,))

    panels(W, lambda c, pw: ((pw, H - 0.004, T), (c, H / 2, -D / 2 + T / 2)), "back_panels", "wall_back", "-z")
    panels(D, lambda c, pw: ((T, H - 0.004, pw), (-W / 2 + T / 2, H / 2, c)), None, "wall_left", "-x")
    panels(D, lambda c, pw: ((T, H - 0.004, pw), (W / 2 - T / 2, H / 2, c)), None, "wall_right", "+x")

    # stainless kick plates
    b.box("kick_back", (W - 2 * T, 0.1, 0.004), (0, 0.05, -D / 2 + T + 0.002), "steel", "back_panels", bevel=0.001)
    b.box("kick_left", (0.004, 0.1, D - 2 * T), (-W / 2 + T + 0.002, 0.05, 0), "steel", bevel=0.001)
    b.box("kick_right", (0.004, 0.1, D - 2 * T), (W / 2 - T - 0.002, 0.05, 0), "steel", bevel=0.001)

    # panoramic glass back wall (variant)
    b.box("glass_pane", (W - 0.06, H - 0.06, 0.012), (0, H / 2, -D / 2 + 0.01), "glass", "glass_back", bevel=0)
    for i, (x, y, w, h) in enumerate([(0, H - 0.03, W, 0.06), (0, 0.03, W, 0.06), (-W / 2 + 0.03, H / 2, 0.06, H), (W / 2 - 0.03, H / 2, 0.06, H), (0, H / 2, 0.04, H)]):
        b.box(f"glass_frame_{i}", (w, h, 0.04), (x, y, -D / 2 + 0.02), "steel", "glass_back")

    # door wall
    opening = min(W - 0.2, 1.1 if W >= 1.4 else 0.9 if W >= 1.1 else 0.8)
    dh = 2.1
    side = (W - opening) / 2
    zf = D / 2
    for s in (-1, 1):
        b.box(f"wall_front_{'l' if s < 0 else 'r'}", (side, H, T), (s * (opening / 2 + side / 2), H / 2, zf - T / 2), "wall", drop=("+z",))
        b.box(f"jamb_{'l' if s < 0 else 'r'}", (0.03, dh, 0.014), (s * (opening / 2 + 0.015), dh / 2, zf - T - 0.007), "steel", bevel=0.002)
    b.box("wall_front_header", (opening, H - dh, T), (0, dh + (H - dh) / 2, zf - T / 2), "wall", drop=("+z",))
    b.box("jamb_top", (opening + 0.06, 0.03, 0.014), (0, dh + 0.015, zf - T - 0.007), "steel", bevel=0.002)
    # door reveal (the depth between wall face and leaves)
    for s in (-1, 1):
        b.box(f"reveal_{'l' if s < 0 else 'r'}", (0.004, dh, 0.06), (s * (opening / 2 + 0.002), dh / 2, zf + 0.01), "steel", bevel=0)
    b.box("reveal_top", (opening, 0.004, 0.06), (0, dh + 0.002, zf + 0.01), "steel", bevel=0)

    # sill with grooves
    b.box("sill", (opening + 0.1, 0.008, 0.1), (0, 0.004, zf + 0.02), "steel", bevel=0.0015)
    for i in range(5):
        b.box(f"sill_groove_{i}", (opening + 0.08, 0.0015, 0.004), (0, 0.0085, zf - 0.02 + i * 0.018), "dark", bevel=0)

    # door leaves (two variants)
    for s in (-1, 1):
        b.box(f"door_c_{'l' if s < 0 else 'r'}", (opening / 2 - 0.003, dh - 0.004, 0.03), (s * (opening / 4 + 0.0015), dh / 2, zf + 0.03), "door", "door_center", bevel=0.004, drop=("+z",))
    b.box("door_s_a", ((opening * 2) / 3, dh - 0.004, 0.03), (opening / 6, dh / 2, zf + 0.03), "door", "door_side", bevel=0.004, drop=("+z",))
    b.box("door_s_b", (opening / 3 + 0.02, dh - 0.004, 0.03), (-opening / 3, dh / 2, zf + 0.065), "door", "door_side", bevel=0.004, drop=("+z",))

    # ---------- ceilings (variants)
    def frame(group, w, d, y, bar=0.03, depth=0.03):
        b.box(f"{group}_rim_f", (w + bar * 2, depth, bar), (0, y, d / 2 + bar / 2), "steel", group, bevel=0.002)
        b.box(f"{group}_rim_b", (w + bar * 2, depth, bar), (0, y, -d / 2 - bar / 2), "steel", group, bevel=0.002)
        b.box(f"{group}_rim_l", (bar, depth, d), (-w / 2 - bar / 2, y, 0), "steel", group, bevel=0.002)
        b.box(f"{group}_rim_r", (bar, depth, d), (w / 2 + bar / 2, y, 0), "steel", group, bevel=0.002)

    lw, ld = W - 0.4, D - 0.4
    b.box("ceil_led_panel", (lw, 0.006, ld), (0, H - 0.018, 0), "light", "ceil_led", bevel=0, drop=("+x", "-x", "+y", "+z", "-z"))
    frame("ceil_led", lw, ld, H - 0.012, bar=0.025, depth=0.024)

    cols, rows = max(2, round(W / 0.4)), max(2, round(D / 0.4))
    for i in range(cols):
        for j in range(rows):
            x = -W / 2 + (i + 0.5) * W / cols
            z = -D / 2 + (j + 0.5) * D / rows
            b.cylinder(f"ceil_spot_{i}_{j}", 0.05, 0.008, (x, H - 0.004, z), "y", "steel", "ceil_spots", segs=20, bevel=0.002, bevel_segs=1)
            b.cylinder(f"ceil_spot_led_{i}_{j}", 0.034, 0.004, (x, H - 0.009, z), "y", "light", "ceil_spots", segs=20)

    bw, bd = W - 0.12, D - 0.12
    b.box("ceil_backlit_panel", (bw, 0.006, bd), (0, H - 0.04, 0), "light", "ceil_backlit", bevel=0, drop=("+x", "-x", "+y", "+z", "-z"))
    frame("ceil_backlit", bw, bd, H - 0.025, bar=0.02, depth=0.05)
    n_div = max(1, round(bd / 0.5)) - 1
    for i in range(n_div):
        z = -bd / 2 + (i + 1) * bd / (n_div + 1)
        b.box(f"ceil_backlit_div_{i}", (bw, 0.014, 0.022), (0, H - 0.045, z), "steel", "ceil_backlit", bevel=0.002)
    b.box("ceil_backlit_spine", (0.022, 0.014, bd), (0, H - 0.045, 0), "steel", "ceil_backlit", bevel=0.002)

    cw, cd = W - 0.3, D - 0.3
    b.box("ceil_crystal_panel", (cw, 0.006, cd), (0, H - 0.018, 0), "light", "ceil_crystal", bevel=0, drop=("+x", "-x", "+y", "+z", "-z"))
    frame("ceil_crystal", cw, cd, H - 0.012, bar=0.03, depth=0.024)
    crystals(b, W, D)

    # ---------- handrails
    def rail(name, group, length, pos, axis, wall_dir):
        y = 0.9
        off = 0.055
        b.cylinder(f"{name}_tube", 0.019, length, pos, axis, "handrail", group, segs=24, bevel=0.012, bevel_segs=3)
        for k in (-1, 1):
            p = list(pos)
            idx = 0 if axis == "x" else 2
            p[idx] += k * (length / 2 - 0.08)
            w = [0, 0, 0]
            w[0 if wall_dir in ("x+", "x-") else 2] = (1 if wall_dir.endswith("+") else -1) * off / 2
            bp = (p[0] + w[0], y, p[2] + w[2])
            b.cylinder(f"{name}_post_{k}", 0.01, off, bp, "x" if wall_dir.startswith("x") else "z", "handrail", group, segs=12)
            plate = (p[0] + w[0] * 2, y, p[2] + w[2] * 2)
            b.cylinder(f"{name}_rose_{k}", 0.026, 0.006, plate, "x" if wall_dir.startswith("x") else "z", "handrail", group, segs=16, bevel=0.002, bevel_segs=1)

    off = 0.055 + T
    rail("rail_back", "handrail_back", W - 0.3, (0, 0.9, -D / 2 + off), "x", "z-")
    rail("rail_left", "handrail_sides", D - 0.5, (-W / 2 + off, 0.9, -0.1), "z", "x-")
    rail("rail_right", "handrail_sides", D - 0.5, (W / 2 - off, 0.9, -0.1), "z", "x+")

    # ---------- car operating panels (on the left wall near the door)
    px = -W / 2 + T
    pz = D / 2 - 0.26
    # buttons variant
    h, w, y = 1.05, 0.22, 1.15
    b.box("cop_body", (0.012, h, w), (px + 0.006, y, pz), "steel", "cop_buttons", bevel=0.003)
    b.plane("cop_display_lcd", (w - 0.08, 0.08), (px + 0.0125, y + h / 2 - 0.09, pz), "display", "+x", "cop_buttons")
    b.plane("cop_display_tft", (w - 0.04, (w - 0.04) * 0.75), (px + 0.0125, y + h / 2 - 0.13, pz), "display", "+x", "cop_buttons")
    top = y + h / 2 - 0.29
    for i in range(20):
        col, row = i % 2, i // 2
        bz = pz + (0.5 - col) * 0.075
        by = top - row * 0.052
        grp = f"btn_{i:02d}"
        b.group(grp).parent = b.group("cop_buttons")
        b.cylinder(f"{grp}_cap", 0.016, 0.007, (px + 0.0155, by, bz), "x", "steel", grp, segs=16, bevel=0.002, bevel_segs=1)
        b.cylinder(f"{grp}_ring", 0.013, 0.001, (px + 0.0195, by, bz), "x", "btn_ring", grp, segs=16)
    # touch variant
    b.box("cop_touch_body", (0.012, 0.78, 0.22), (px + 0.006, 1.25, pz), "dark", "cop_touch", bevel=0.004)
    b.plane("cop_touch_display", (0.18, 0.135), (px + 0.0125, 1.25 + 0.39 - 0.1, pz), "display", "+x", "cop_touch")
    b.plane("cop_touch_screen", (0.18, 0.5), (px + 0.0125, 1.25 - 0.1, pz), "touch", "+x", "cop_touch")

    # ---------- extras
    b.box("extra_vent", (min(0.6, W - 0.3), 0.012, 0.06), (0, H - 0.006, D / 2 - 0.12), "dark", "extra_fan", bevel=0.001)
    b.box("extra_ac_unit", (min(0.7, W - 0.3), 0.02, 0.14), (0, H - 0.01, D / 2 - 0.14), "dark", "extra_ac", bevel=0.002)
    dome = bmesh.new()
    bmesh.ops.create_uvsphere(dome, u_segments=24, v_segments=12, radius=0.045)
    bmesh.ops.delete(dome, geom=[v for v in dome.verts if v.co.z < -1e-4], context="VERTS")
    bmesh.ops.reverse_faces(dome, faces=dome.faces)  # hemisphere hangs down: flip so normals face out
    for v in dome.verts:
        v.co = Vector((v.co.x, v.co.y, -v.co.z)) + bl(W / 2 - 0.12, H, -D / 2 + 0.12)
    bmesh.ops.reverse_faces(dome, faces=dome.faces)
    b.add("extra_camera_dome", dome, "dark", "extra_camera", smooth=True)
    b.cylinder("extra_voice_grille", 0.04, 0.004, (-W / 2 + 0.15, H - 0.002, -D / 2 + 0.15), "y", "dark", "extra_voice", segs=32)
    b.cylinder("extra_intercom_grille", 0.025, 0.003, (px + 0.0135, y - h / 2 + 0.07, pz), "x", "dark", "extra_intercom", segs=24)
    b.box("extra_card_reader", (0.02, 0.12, 0.09), (px + 0.01, y - h / 2 - 0.1, pz), "dark", "extra_card", bevel=0.004)
    for s in (-1, 1):
        b.box(f"extra_curtain_{'l' if s < 0 else 'r'}", (0.012, 1.8, 0.012), (s * (opening / 2 - 0.006), 1.0, zf + 0.004), "dark", "extra_light-curtain", bevel=0.001)

    return b


def crystals(b, W, D):
    """~110 faceted crystals on wires, joined into two meshes to keep the draw count low."""
    rnd = lambda s: ((math.sin(s * 91.7) * 43758.5453) % 1 + 1) % 1
    gems = bmesh.new()
    wires = bmesh.new()
    from mathutils import Matrix

    for i in range(110):
        x = (rnd(i) - 0.5) * (W - 0.5)
        z = (rnd(i + 100) - 0.5) * (D - 0.5)
        drop = 0.04 + rnd(i + 200) * 0.16
        s = 0.016 + rnd(i + 300) * 0.018
        g = bmesh.new()
        bmesh.ops.create_icosphere(g, subdivisions=0, radius=s)
        for v in g.verts:
            v.co.z *= 1.6  # elongated drop
        bmesh.ops.rotate(g, verts=g.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(i * 0.7, 3, "Z"))
        for v in g.verts:
            v.co += bl(x, H - 0.018 - drop, z)
        tmp = bpy.data.meshes.new("tmp")
        g.to_mesh(tmp)
        gems.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        g.free()
        w = bmesh.new()
        bmesh.ops.create_cone(w, cap_ends=False, segments=4, radius1=0.0012, radius2=0.0012, depth=drop)
        for v in w.verts:
            v.co += bl(x, H - 0.018 - drop / 2, z)
        tmp = bpy.data.meshes.new("tmp")
        w.to_mesh(tmp)
        wires.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        w.free()
    b.add("ceil_crystal_gems", gems, "crystal", "ceil_crystal")
    b.add("ceil_crystal_wires", wires, "steel", "ceil_crystal")


# ---------------------------------------------------------------- AO bake


# Each pass bakes one variant group with only the core shell around it, so a hidden
# variant never leaves a shadow on the walls.
PASSES = [
    ["core", "back_panels"],
    ["glass_back"],
    ["door_center"],
    ["door_side"],
    ["ceil_led"],
    ["ceil_spots"],
    ["ceil_backlit"],
    ["ceil_crystal"],
    ["handrail_back", "handrail_sides"],
    ["cop_buttons"],  # panel body alone: hidden buttons must not leave shadows on it
    ["btn_*"],
    ["cop_touch"],
    ["extra_*"],
]


def group_of(obj):
    return obj["grp"]


def matches(grp, patterns):
    return any(grp == p or (p.endswith("*") and grp.startswith(p[:-1])) for p in patterns)


def pick_device():
    """Use a GPU for Cycles when one is available; baking on CPU works but is slow."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
        except TypeError:
            continue
        gpus = [d for d in prefs.devices if d.type == kind]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == kind
            print(f"  cycles device: {kind} ({', '.join(d.name for d in gpus)})", flush=True)
            return "GPU"
    print("  cycles device: CPU", flush=True)
    return "CPU"


def bake_ao(b, samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = pick_device()
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 8
    scene.render.bake.use_clear = False
    if not scene.world:
        scene.world = bpy.data.worlds.new("World")
    scene.world.light_settings.distance = 0.35

    bakeable = [o for o in b.objects if o["mat"] not in NO_AO]

    # Second UV layer packed across all objects into one shared atlas.
    for o in bakeable:
        o.data.uv_layers.new(name="AO")
        o.data.uv_layers.active = o.data.uv_layers["AO"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in bakeable:
        o.select_set(True)
    bpy.context.view_layer.objects.active = bakeable[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin=0.0035, shape_method="AABB")
    bpy.ops.object.mode_set(mode="OBJECT")

    img = bpy.data.images.new("ao", ATLAS, ATLAS, alpha=False)
    img.generated_color = (1, 1, 1, 1)
    img.colorspace_settings.name = "Non-Color"
    nodes = []
    for m in b.mats.values():
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
        nodes.append((m, n))

    for patterns in PASSES:
        group = [o for o in bakeable if matches(group_of(o), patterns)]
        if not group:
            continue
        for o in b.objects:
            visible = group_of(o) in ("core", "back_panels") or matches(group_of(o), patterns)
            o.hide_render = not visible
        bpy.ops.object.select_all(action="DESELECT")
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.bake(type="AO", use_clear=False, margin=8)
        print(f"  baked {patterns}: {len(group)} objects", flush=True)

    for o in b.objects:
        o.hide_render = False
        if "AO" in o.data.uv_layers:
            o.data.uv_layers.active = o.data.uv_layers[0]
    for m, n in nodes:
        m.node_tree.nodes.remove(n)
    return img


# ---------------------------------------------------------------- main


def run():
    opts = args()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    for cap in opts["sizes"]:
        W, D = SIZES[cap]
        print(f"[{cap}] building {W}x{D}", flush=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        b = build(W, D)
        img = bake_ao(b, opts["samples"])
        ao_path = os.path.join(OUT, f"ao-{cap}.jpg")
        img.filepath_raw = ao_path
        img.file_format = "JPEG"
        bpy.context.scene.render.image_settings.quality = 85
        img.save(filepath=ao_path, quality=85)
        glb = os.path.join(RAW, f"cabin-{cap}.glb")
        bpy.ops.export_scene.gltf(
            filepath=glb,
            export_format="GLB",
            export_yup=True,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_cameras=False,
            export_lights=False,
            export_extras=False,
            export_apply=True,
        )
        print(f"[{cap}] wrote {os.path.basename(glb)} ({os.path.getsize(glb) // 1024} KB), ao ({os.path.getsize(ao_path) // 1024} KB)", flush=True)


run()

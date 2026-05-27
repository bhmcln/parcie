# Pallet packing viewer

Standalone HTML prototype of an isometric pallet-packing visualisation.
Open `pallet-viewer.html` in any browser — no build step, no dependencies.

## Controls

- **Drag** the viewport to rotate (yaw only — pitch is locked to true
  isometric)
- **Scroll** to zoom
- **Click** a box to isolate it; click again or click empty space to deselect
- Use the toolbar buttons for ±15° rotation steps and reset

## How the projection works

True isometric projection uses a fixed pitch of `atan(1/sqrt(2))` (~35.264°),
which is what makes all three axes appear at equal length on screen. Only the
yaw (rotation around the vertical axis) is interactive. Letting the user
change pitch breaks the isometric look — it starts feeling like a generic 3D
viewer.

The projection function:

```js
function project(x, y, z) {
  // centre on pallet origin
  const cx = x - palletW / 2;
  const cy = y - palletD / 2;
  // rotate around z by yaw
  const rx = cx * Math.cos(yaw) - cy * Math.sin(yaw);
  const ry = cx * Math.sin(yaw) + cy * Math.cos(yaw);
  // project to screen
  const sx = rx * scale;
  const sy = (ry * Math.sin(pitch) - z * Math.cos(pitch)) * scale;
  // depth for z-sorting
  const depth = ry * Math.cos(pitch) + z * Math.sin(pitch);
  return { x: sx, y: sy, depth };
}
```

Each box renders three visible faces (top, front, right) at slightly
different opacities to fake directional lighting without gradients. Edges
are drawn as separate `<line>` elements on top so they stay crisp at any
zoom.

## Z-sorting

Boxes are sorted by average vertex depth before rendering. This is the
"painter's algorithm" and works correctly for axis-aligned cuboids that
don't intersect — which is the case for valid pallet-packing solutions.
If your real solver ever produces interpenetrating boxes (unlikely), you'd
need triangle-level sorting or a BSP tree.

## Converting to React

The vanilla code maps cleanly onto a single React component. Sketch:

```tsx
type Box = { x: number; y: number; z: number; w: number; d: number; h: number; sku: number };
type Sku = { id: string; name: string; ramp: { fill: string; stroke: string } };

type Props = {
  boxes: Box[];
  skus: Sku[];
  palletWidth?: number;
  palletDepth?: number;
};

export function PalletViewer({ boxes, skus, palletWidth = 100, palletDepth = 80 }: Props) {
  const [yaw, setYaw] = useState(Math.PI / 4);
  const [scale, setScale] = useState(2.4);
  const [selected, setSelected] = useState<number | null>(null);
  const pitch = Math.atan(1 / Math.sqrt(2));

  // Memoise the projection — it only changes when yaw/scale change
  const projected = useMemo(() => {
    return boxes.map((b, i) => projectBox(b, i, { yaw, pitch, scale, palletWidth, palletDepth }));
  }, [boxes, yaw, scale, palletWidth, palletDepth]);

  // Sort once per render
  const sorted = useMemo(
    () => [...projected].sort((a, b) => a.depth - b.depth),
    [projected]
  );

  // Drag handler using pointer events
  const onPointerDown = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startYaw = yaw;
    const onMove = (ev: PointerEvent) => setYaw(startYaw + (ev.clientX - startX) * 0.012);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <Card>
      <CardHeader>{/* title + controls */}</CardHeader>
      <svg viewBox="-340 -260 680 480" onPointerDown={onPointerDown} onWheel={onWheel}>
        <Pallet projection={...} />
        <Axes projection={...} />
        {sorted.map(box => (
          <BoxMesh
            key={box.idx}
            box={box}
            selected={selected === box.idx}
            dimmed={selected !== null && selected !== box.idx}
            onClick={() => setSelected(selected === box.idx ? null : box.idx)}
          />
        ))}
      </svg>
      <Legend skus={skus} boxes={boxes} />
      <Detail box={selected !== null ? boxes[selected] : null} sku={...} />
    </Card>
  );
}
```

### Notes for the conversion

- **`useMemo` the projection**, not the SVG output. The projected vertex
  arrays are what's expensive to recompute as `yaw` changes during a drag.
  Re-rendering the SVG itself is cheap.

- **Use `pointer` events, not `mouse` events** — they handle mouse, touch,
  and pen uniformly, so you can drop the separate `touchmove` handler.

- **Throttle drag updates with `requestAnimationFrame`** if you see jank
  on large solutions. Coalesce multiple pointer moves into one state update
  per frame:

  ```tsx
  const pendingYaw = useRef<number | null>(null);
  const onMove = (ev: PointerEvent) => {
    pendingYaw.current = startYaw + (ev.clientX - startX) * 0.012;
    if (!rafScheduled.current) {
      rafScheduled.current = true;
      requestAnimationFrame(() => {
        if (pendingYaw.current !== null) setYaw(pendingYaw.current);
        rafScheduled.current = false;
      });
    }
  };
  ```

- **For shadcn/ui integration**, the natural decomposition is:
  - `<Card>` wrapping the whole thing
  - `<CardHeader>` for title + `<Button variant="outline" size="icon">` toolbar
  - `<Badge>` for the legend items
  - Detail row stays as plain text under the viewport
  - If you add an exploded view or layer slicer, `<Slider>` in a
    `<CardFooter>` works nicely

- **CSS variables** in the standalone HTML map to your Tailwind theme tokens.
  Replace `var(--surface)` with `bg-muted`, `var(--text-muted)` with
  `text-muted-foreground`, etc. Or just keep them as CSS custom properties
  in your global stylesheet — shadcn already uses that pattern.

- **Type the data model strictly.** If your Rust solver outputs JSON, derive
  the TypeScript types from the same schema (e.g. with `typeshare` or
  `ts-rs`) so you can't drift.

## Extending the prototype

Ideas that fit the design language and would be useful:

- **Exploded view** — animate each box's `z` by `i * 20` over 400ms with
  `framer-motion` to separate the layers
- **Layer slicer** — vertical slider that sets a z-threshold; fade boxes
  above it to ~10% opacity for inspection
- **Snap views** — toolbar buttons for front / side / top that animate `yaw`
  to `0`, `π/2`, etc. (top view needs a separate orthographic-top projection)
- **Stability indicators** — red edges on boxes whose centre of mass falls
  outside the support polygon of the boxes below
- **Ghost mode for unplaced inventory** — render rejected boxes off to the
  side with dashed edges and reduced opacity
- **Hover preview** — show the detail row on hover, not just click, with
  a 100ms debounce to avoid flicker

## Performance

The vanilla version handles a few hundred boxes comfortably in a tight drag
loop. Past ~1000 boxes you'd want to:

- Switch to a `<canvas>` renderer for the boxes (keep SVG for the pallet
  and overlays)
- Or render to an offscreen canvas and only update on drag-end, with a
  low-detail SVG preview during drag

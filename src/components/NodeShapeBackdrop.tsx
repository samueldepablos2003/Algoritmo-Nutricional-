import React from 'react';
import type { NodeShape } from '../types/algorithm';

interface NodeShapeBackdropProps {
  shape: NodeShape;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  highlightRing?: boolean;
}

/**
 * Renders an exact vector shape backdrop (oval, diamond, parallelogram, hexagon, block arrows)
 * with crisp non-clipped borders and optional blue selection halo.
 */
export const NodeShapeBackdrop: React.FC<NodeShapeBackdropProps> = ({
  shape,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  highlightRing = false,
}) => {
  const left = 0;
  const top = 0;
  const right = Math.max(4, width);
  const bottom = Math.max(4, height);
  const w = right - left;
  const h = bottom - top;
  const cx = left + w / 2;
  const cy = top + h / 2;

  const fmt = (n: number) => Number(n.toFixed(2));
  const pts = (coords: Array<[number, number]>) =>
    coords.map(([px, py]) => `${fmt(px)},${fmt(py)}`).join(' ');

  const renderShapeElement = (isHalo: boolean) => {
    const commonProps = isHalo
      ? {
          fill: 'none',
          stroke: 'rgba(0, 113, 227, 0.22)',
          strokeWidth: strokeWidth + 6,
          strokeLinejoin: 'round' as const,
          vectorEffect: 'non-scaling-stroke' as const,
        }
      : {
          fill,
          stroke,
          strokeWidth,
          strokeLinejoin: 'round' as const,
          vectorEffect: 'non-scaling-stroke' as const,
        };

    switch (shape) {
      case 'oval':
        return (
          <ellipse
            cx={fmt(cx)}
            cy={fmt(cy)}
            rx={fmt(w / 2)}
            ry={fmt(h / 2)}
            {...commonProps}
          />
        );

      case 'diamond':
        return (
          <polygon
            points={pts([
              [cx, top],
              [right, cy],
              [cx, bottom],
              [left, cy],
            ])}
            {...commonProps}
          />
        );

      case 'parallelogram': {
        const skew = Math.min(w * 0.16, 36);
        return (
          <polygon
            points={pts([
              [left + skew, top],
              [right, top],
              [right - skew, bottom],
              [left, bottom],
            ])}
            {...commonProps}
          />
        );
      }

      case 'hexagon': {
        const indent = Math.min(w * 0.14, 34);
        return (
          <polygon
            points={pts([
              [left + indent, top],
              [right - indent, top],
              [right, cy],
              [right - indent, bottom],
              [left + indent, bottom],
              [left, cy],
            ])}
            {...commonProps}
          />
        );
      }

      case 'block-arrow': {
        const headW = Math.min(w * 0.2, 46);
        const shaftTop = top + h * 0.16;
        const shaftBottom = bottom - h * 0.16;
        return (
          <polygon
            points={pts([
              [left, shaftTop],
              [right - headW, shaftTop],
              [right - headW, top],
              [right, cy],
              [right - headW, bottom],
              [right - headW, shaftBottom],
              [left, shaftBottom],
            ])}
            {...commonProps}
          />
        );
      }

      case 'thin-arrow': {
        const headW = Math.min(w * 0.18, 42);
        const shaftTop = top + h * 0.24;
        const shaftBottom = bottom - h * 0.24;
        return (
          <polygon
            points={pts([
              [left, shaftTop],
              [right - headW, shaftTop],
              [right - headW, top],
              [right, cy],
              [right - headW, bottom],
              [right - headW, shaftBottom],
              [left, shaftBottom],
            ])}
            {...commonProps}
          />
        );
      }

      case 'double-arrow': {
        const headW = Math.min(w * 0.16, 38);
        const shaftTop = top + h * 0.18;
        const shaftBottom = bottom - h * 0.18;
        return (
          <polygon
            points={pts([
              [left, cy],
              [left + headW, top],
              [left + headW, shaftTop],
              [right - headW, shaftTop],
              [right - headW, top],
              [right, cy],
              [right - headW, bottom],
              [right - headW, shaftBottom],
              [left + headW, shaftBottom],
              [left + headW, bottom],
            ])}
            {...commonProps}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ filter: 'drop-shadow(0 2px 6px rgba(29, 29, 31, 0.08))' }}
    >
      {highlightRing && renderShapeElement(true)}
      {renderShapeElement(false)}
    </svg>
  );
};

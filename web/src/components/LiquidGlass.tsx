import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  contentClassName?: string;
  radius?: string;
  blur?: string;
  displacement?: string;
  interactive?: boolean;
}

export const LiquidGlassFilters = () => (
  <svg className="lumina-liquid-glass-filters" aria-hidden="true" focusable="false">
    <defs>
      <filter id="lumina-liquid-glass-refraction" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" result="displaced" />
        <feColorMatrix in="displaced" type="saturate" values="1.28" result="saturated" />
        <feComponentTransfer in="saturated">
          <feFuncR type="gamma" amplitude="1.03" exponent="0.96" offset="0.01" />
          <feFuncG type="gamma" amplitude="1" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0.98" exponent="1.03" offset="0.01" />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
);

const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(
  ({ children, className, contentClassName, radius, blur, displacement, interactive = true, style, onPointerMove, ...props }, ref) => {
    const labelId = useId();
    const [pointer, setPointer] = useState({ x: 50, y: 50 });

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        if (!interactive) {
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        });
      },
      [interactive, onPointerMove],
    );

    const mergedStyle = useMemo(
      () =>
        ({
          ...style,
          "--liquid-x": `${pointer.x}%`,
          "--liquid-y": `${pointer.y}%`,
          ...(radius ? { "--liquid-radius": radius } : {}),
          ...(blur ? { "--liquid-blur": blur } : {}),
          ...(displacement ? { "--liquid-displacement": displacement } : {}),
        }) as CSSProperties,
      [blur, displacement, pointer.x, pointer.y, radius, style],
    );

    return (
      <div
        ref={ref}
        className={cn("lumina-liquid-glass", interactive && "is-interactive", className)}
        style={mergedStyle}
        onPointerMove={handlePointerMove}
        data-liquid-glass-id={labelId}
        {...props}
      >
        <div className={cn("lumina-liquid-glass-content", contentClassName)}>{children}</div>
      </div>
    );
  },
);

LiquidGlass.displayName = "LiquidGlass";

export default LiquidGlass;

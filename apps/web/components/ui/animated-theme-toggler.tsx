"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/utils";

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number;
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const [isDark, setIsDark] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = useCallback(async () => {
    const button = buttonRef.current;
    if (!button) return;

    const root = document.documentElement;
    const newTheme = !root.classList.contains("dark");
    const updateTheme = () => {
      flushSync(() => {
        setIsDark(newTheme);
        root.classList.toggle("dark", newTheme);
        try {
          localStorage.setItem("theme", newTheme ? "dark" : "light");
        } catch {
          return;
        }
      });
    };

    const startViewTransition = (
      document as Document & {
        startViewTransition?: (callback: () => void) => { ready: Promise<void> };
      }
    ).startViewTransition;

    if (!startViewTransition) {
      updateTheme();
      return;
    }

    const { top, left, width, height } = button.getBoundingClientRect();
    await startViewTransition.call(document, updateTheme).ready;

    const x = left + width / 2;
    const y = top + height / 2;
    const maxRadius = Math.hypot(
      Math.max(left, window.innerWidth - left),
      Math.max(top, window.innerHeight - top),
    );

    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  }, [duration]);

  const buttonLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  const buttonClassName = cn(
    "inline-flex size-10 shrink-0 items-center justify-center rounded-full border bg-background/80 text-foreground shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
    className,
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggleTheme}
      className={buttonClassName}
      aria-label={buttonLabel}
      aria-pressed={isDark}
      title={buttonLabel}
      {...props}
    >
      {isDark ? (
        <Sun className="size-4 transition-transform duration-300" />
      ) : (
        <Moon className="size-4 transition-transform duration-300" />
      )}
      <span className="sr-only">{buttonLabel}</span>
    </button>
  );

};

import { cn } from "../cn";
import type { ReactNode } from "react";
import styles from "./CircularButton.module.css";

type CircularButtonProps = {
  backgroundColor?: string;
  textColor?: string;
  text: string;
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};

const CircularButton = ({
  backgroundColor,
  textColor,
  text,
  onClick,
  ariaLabel,
  title,
  disabled = false,
  className,
  children,
}: CircularButtonProps) => {
  return (
    <button
      type="button"
      className={cn(styles.root, className)}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      style={{ background: backgroundColor, color: textColor }}
    >
      {children ?? text}
    </button>
  );
};

export default CircularButton;

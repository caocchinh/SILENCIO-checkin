"use client";
import { cn } from "@/lib/utils";
import styles from "./Loader.module.css";

const Loader = ({
  loadingText,
  className,
}: {
  loadingText?: string;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-5 bg-transparent ",
        className
      )}
    >
      <div
        className={styles.loader}
        style={{ backgroundImage: "transparent" }}
      />
      <p className="text-sm text-gray-500">{loadingText}</p>
    </div>
  );
};

export default Loader;

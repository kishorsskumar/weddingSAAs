import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedSkeletonProps {
  className?: string;
  count?: number;
}

export function AnimatedSkeleton({ className = "", count = 1 }: AnimatedSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "bg-muted rounded-md overflow-hidden relative",
            className
          )}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.1,
            }}
          />
        </motion.div>
      ))}
    </>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={cn("p-4 rounded-lg border bg-card", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <AnimatedSkeleton className="h-4 w-1/3 mb-3" />
      <AnimatedSkeleton className="h-8 w-1/2 mb-2" />
      <AnimatedSkeleton className="h-3 w-2/3" />
    </motion.div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-3">
          <AnimatedSkeleton className="h-4 w-full" />
        </td>
      ))}
    </motion.tr>
  );
}

export function ListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <AnimatedSkeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <AnimatedSkeleton className="h-4 w-3/4" />
            <AnimatedSkeleton className="h-3 w-1/2" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const gridColumnClasses: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export function GridSkeleton({ items = 6, columns = 3 }: { items?: number; columns?: number }) {
  const lgColClass = gridColumnClasses[columns] || "lg:grid-cols-3";
  return (
    <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", lgColClass)}>
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

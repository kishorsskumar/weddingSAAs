import { motion, MotionProps } from "framer-motion";
import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cardHover, buttonTap, scaleIn, springTransition } from "@/lib/animations";

interface AnimatedCardProps extends Omit<MotionProps, 'children'> {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  clickable?: boolean;
  delay?: number;
}

export function AnimatedCard({ 
  children, 
  className = "", 
  hoverEffect = true, 
  clickable = false,
  delay = 0,
  ...motionProps 
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={hoverEffect ? cardHover : undefined}
      whileTap={clickable ? buttonTap : undefined}
      {...motionProps}
    >
      <Card className={cn("transition-shadow duration-200", hoverEffect && "hover:shadow-lg", className)}>
        {children}
      </Card>
    </motion.div>
  );
}

interface AnimatedButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function AnimatedButton({ 
  children, 
  className = "", 
  onClick, 
  disabled,
  type = "button",
  variant = "default"
}: AnimatedButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={springTransition}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </motion.button>
  );
}

interface AnimatedGridProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedGrid({ children, className = "" }: AnimatedGridProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.08,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedGridItemProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedGridItem({ children, className = "" }: AnimatedGridItemProps) {
  return (
    <motion.div
      variants={{
        initial: { opacity: 0, scale: 0.9, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({ 
  value, 
  className = "",
  prefix = "",
  suffix = ""
}: { 
  value: number; 
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {prefix}{value.toLocaleString()}{suffix}
    </motion.span>
  );
}

interface AnimatedBadgeProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "error";
}

export function AnimatedBadge({ children, className = "", variant = "default" }: AnimatedBadgeProps) {
  const colorClasses = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        colorClasses[variant],
        className
      )}
    >
      {children}
    </motion.span>
  );
}

interface AnimatedIconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function AnimatedIconButton({ children, onClick, className = "", disabled }: AnimatedIconButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.1, rotate: 5 }}
      whileTap={disabled ? {} : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className = "" }: AnimatedCounterProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={className}
    >
      {value}
    </motion.span>
  );
}

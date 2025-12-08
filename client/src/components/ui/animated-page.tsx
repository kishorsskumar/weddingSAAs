import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { pageTransition, staggerContainer, staggerItem } from "@/lib/animations";

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedPage({ children, className = "" }: AnimatedPageProps) {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedList({ children, className = "" }: AnimatedListProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedListItemProps {
  children: ReactNode;
  className?: string;
  index?: number;
}

export function AnimatedListItem({ children, className = "", index = 0 }: AnimatedListItemProps) {
  return (
    <motion.div
      variants={staggerItem}
      transition={{ delay: index * 0.05 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedPresenceWrapperProps {
  children: ReactNode;
  isVisible: boolean;
}

export function AnimatedPresenceWrapper({ children, isVisible }: AnimatedPresenceWrapperProps) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && children}
    </AnimatePresence>
  );
}

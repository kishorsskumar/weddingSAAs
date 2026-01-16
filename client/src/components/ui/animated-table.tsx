import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { tableRow, tableContainer } from "@/lib/animations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AnimatedTableBodyProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedTableBody({ children, className = "" }: AnimatedTableBodyProps) {
  return (
    <motion.tbody
      variants={tableContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.tbody>
  );
}

interface AnimatedTableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export function AnimatedTableRow({ 
  children, 
  className = "", 
  onClick,
  hoverEffect = true 
}: AnimatedTableRowProps) {
  return (
    <motion.tr
      variants={tableRow}
      whileHover={hoverEffect ? { 
        backgroundColor: "rgba(107, 153, 55, 0.05)",
        transition: { duration: 0.15 }
      } : undefined}
      onClick={onClick}
      className={className}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      {children}
    </motion.tr>
  );
}

interface AnimatedListContainerProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedListContainer({ children, className = "" }: AnimatedListContainerProps) {
  return (
    <motion.div
      variants={tableContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedListRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AnimatedListRow({ children, className = "", onClick }: AnimatedListRowProps) {
  return (
    <motion.div
      variants={tableRow}
      whileHover={{ 
        x: 4,
        backgroundColor: "rgba(107, 153, 55, 0.05)",
        transition: { duration: 0.15 }
      }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={className}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      {children}
    </motion.div>
  );
}

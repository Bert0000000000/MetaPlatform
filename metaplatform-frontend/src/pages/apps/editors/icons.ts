/**
 * Icon mapper for the low-code designer.
 *
 * Maps field-library icon names to lucide-react components so the
 * palette and canvas can render them dynamically.
 */

import {
  Type,
  AlignLeft,
  Hash,
  ChevronDownSquare,
  CircleDot,
  CheckSquare,
  ToggleLeft,
  Calendar,
  CalendarClock,
  Mail,
  Smartphone,
  Link,
  Star,
  FileText,
  Paperclip,
  Image,
  PenTool,
  MapPin,
  Palette,
  SlidersHorizontal,
  CircleDollarSign,
  Percent,
  GitBranch,
  FunctionSquare,
  Minus,
  Heading,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Type,
  AlignLeft,
  Hash,
  ChevronDownSquare,
  CircleDot,
  CheckSquare,
  ToggleLeft,
  Calendar,
  CalendarClock,
  Mail,
  Smartphone,
  Link,
  Star,
  FileText,
  Paperclip,
  Image,
  PenTool,
  MapPin,
  Palette,
  SlidersHorizontal,
  CircleDollarSign,
  Percent,
  GitBranch,
  FunctionSquare,
  Minus,
  Heading,
};

export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Type;
}

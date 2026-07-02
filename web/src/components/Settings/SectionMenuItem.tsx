import { LucideIcon } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

interface SectionMenuItemProps {
  text: string;
  icon: LucideIcon;
  isSelected: boolean;
  onClick: () => void;
}

const SectionMenuItem: React.FC<SectionMenuItemProps> = ({ text, icon: IconComponent, isSelected, onClick }) => {
  return (
    <div onClick={onClick} className={cn("lumina-settings-nav-item", isSelected && "is-selected")}>
      <IconComponent />
      <span className="truncate">{text}</span>
    </div>
  );
};

export default SectionMenuItem;

import { Globe2Icon, LockIcon, UsersIcon } from "lucide-react";
import { Visibility } from "@/api/types";
import { cn } from "@/lib/utils";

interface Props {
  visibility: Visibility;
  className?: string;
}

const VisibilityIcon = (props: Props) => {
  const { className, visibility } = props;

  let VIcon = null;
  if (visibility === Visibility.PRIVATE) {
    VIcon = LockIcon;
  } else if (visibility === Visibility.PROTECTED) {
    VIcon = UsersIcon;
  } else if (visibility === Visibility.PUBLIC) {
    VIcon = Globe2Icon;
  }
  if (!VIcon) {
    return null;
  }

  return <VIcon className={cn("w-4 h-auto text-muted-foreground", className)} />;
};

export default VisibilityIcon;

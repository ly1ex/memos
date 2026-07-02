import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { ApiError, ApiErrorCode } from "@/api/errors";
import useNavigateTo from "@/hooks/useNavigateTo";

interface UseMemoDetailErrorOptions {
  error: Error | null;
}

const useMemoDetailError = ({ error }: UseMemoDetailErrorOptions) => {
  const navigateTo = useNavigateTo();

  useEffect(() => {
    if (!error) {
      return;
    }

    if (error instanceof ApiError) {
      if (
        error.code === ApiErrorCode.Unauthenticated ||
        error.code === ApiErrorCode.PermissionDenied ||
        error.code === ApiErrorCode.NotFound
      ) {
        navigateTo("/404", { replace: true });
        return;
      }

      toast.error(error.message);
      return;
    }

    toast.error(error.message);
  }, [error, navigateTo]);
};

export default useMemoDetailError;

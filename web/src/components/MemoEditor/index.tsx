import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNewMemo } from "@/contexts/NewMemoContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import { AudioRecorderPanel, EditorContent, EditorMetadata, FocusModeOverlay, TimestampPopover } from "./components";
import { FOCUS_MODE_STYLES } from "./constants";
import { useAudioRecorder, useAutoSave, useFocusMode, useKeyboard, useMemoInit } from "./hooks";
import { errorService, memoService, validationService } from "./services";
import { EditorProvider, useEditorContext, useEditorSelector } from "./state";
import { EditorToolbar, FormattingToolbar } from "./Toolbar";
import type { MemoEditorProps } from "./types";
import type { LocalFile } from "./types/attachment";
import type { EditorController } from "./types/editorController";

const MemoEditor = (props: MemoEditorProps) => (
  <EditorProvider>
    <MemoEditorImpl {...props} />
  </EditorProvider>
);

const MemoEditorImpl: React.FC<MemoEditorProps> = ({
  className,
  header,
  cacheKey,
  memo,
  parentMemoName,
  autoFocus,
  placeholder,
  defaultCreateTime,
  entryType = "MEMO",
  defaultVisibility: defaultVisibilityProp,
  visibilityOptions,
  showVisibilitySelector = true,
  onConfirm,
  onCancel,
}) => {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorController>(null);
  const { actions, dispatch, getState } = useEditorContext();
  // Subscribe only to the low-frequency slices this component renders from, so
  // typing (which changes content) does not re-render the editor shell and its
  // toolbar/metadata children.
  const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
  const hasTimestamp = useEditorSelector((s) => Boolean(s.timestamps.createTime));
  const { userGeneralSetting } = useAuth();
  const { markNewMemo } = useNewMemo();
  const [isAudioRecorderOpen, setIsAudioRecorderOpen] = useState(false);

  const memoName = memo?.name;

  // Get default visibility from user settings
  const defaultVisibility =
    defaultVisibilityProp ??
    (userGeneralSetting?.memoVisibility ? convertVisibilityFromString(userGeneralSetting.memoVisibility) : undefined);

  const { isInitialized } = useMemoInit({
    editorRef,
    memo,
    cacheKey,
    username: currentUser?.name ?? "",
    autoFocus,
    defaultVisibility,
    defaultEntryType: entryType,
    defaultCreateTime,
  });
  const isDraftCacheEnabled = !memo;

  // Auto-save content to localStorage (subscribes to the store internally).
  const { discardDraft } = useAutoSave(currentUser?.name ?? "", cacheKey, isInitialized && isDraftCacheEnabled);

  // Focus mode management with body scroll lock
  useFocusMode(isFocusMode);

  // Live-sync the draft's createTime/updateTime to the calendar-derived prop.
  // Only applies in create mode; edit mode owns its own timestamps. Runs after
  // initial mount (the seed value is set in useMemoInit), and again whenever
  // the prop changes — e.g., when the user picks a different calendar date
  // while the editor is open.
  useEffect(() => {
    if (memo) return;
    if (!isInitialized) return;
    dispatch(
      actions.setTimestamps({
        createTime: defaultCreateTime,
        updateTime: defaultCreateTime,
      }),
    );
  }, [defaultCreateTime, memo, isInitialized, actions, dispatch]);

  useEffect(() => {
    if (memo) return;
    if (!isInitialized) return;
    dispatch(actions.setMetadata(defaultVisibility === undefined ? { entryType } : { visibility: defaultVisibility, entryType }));
  }, [defaultVisibility, entryType, memo, isInitialized, actions, dispatch]);

  const audioRecorder = useAudioRecorder({
    onRecordingComplete: (localFile: LocalFile) => {
      dispatch(actions.addLocalFile(localFile));
      setIsAudioRecorderOpen(false);
    },
    onRecordingEmpty: () => {
      setIsAudioRecorderOpen(false);
    },
  });

  // Mirror the recorder's busy state into the store so validationService.canSave
  // (consumed here and by EditorToolbar) can block saves mid-recording without
  // the reducer owning the recorder's full state.
  useEffect(() => {
    dispatch(actions.setRecorderBusy(audioRecorder.isBusy));
  }, [audioRecorder.isBusy, actions, dispatch]);

  useEffect(() => {
    if (!isAudioRecorderOpen) {
      return;
    }

    if (audioRecorder.status === "error" || audioRecorder.status === "unsupported") {
      toast.error(audioRecorder.error || t("editor.audio-recorder.error-description"));
      setIsAudioRecorderOpen(false);
    }
  }, [isAudioRecorderOpen, audioRecorder.error, audioRecorder.status, t]);

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleStartAudioRecording = async () => {
    setIsAudioRecorderOpen(true);
    await audioRecorder.startRecording();
  };

  const handleAudioRecorderClick = () => {
    if (audioRecorder.isBusy) {
      return;
    }

    void handleStartAudioRecording();
  };

  const handleCancelAudioRecording = () => {
    audioRecorder.resetRecording();
    setIsAudioRecorderOpen(false);
  };

  useKeyboard(editorRef, handleSave);

  async function handleSave() {
    // Read the latest state imperatively — this component no longer subscribes
    // to content, so the closure can't rely on a per-render `state` snapshot.
    const state = getState();
    // Validate before saving
    const { valid, reason } = validationService.canSave(state);
    if (!valid) {
      toast.error(reason || "Cannot save");
      return;
    }

    dispatch(actions.setLoading("saving", true));

    try {
      const result = await memoService.save(state, { memoName, parentMemoName });

      if (!result.hasChanges) {
        toast.error(t("editor.no-changes-detected"));
        onCancel?.();
        return;
      }

      // Clear localStorage cache on successful save and prevent the unmount
      // flush from writing the just-saved content back as a stale draft.
      discardDraft();

      // Invalidate React Query cache to refresh memo lists across the app
      const invalidationPromises = [
        queryClient.invalidateQueries({ queryKey: memoKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
      ];

      // Ensure memo detail pages don't keep stale cached content after edits.
      if (memoName) {
        invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.detail(memoName) }));
      }

      // If this was a comment, also invalidate the comments query for the parent memo
      if (parentMemoName) {
        invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.comments(parentMemoName) }));
      }

      await Promise.all(invalidationPromises);

      // Reset editor state to initial values
      dispatch(actions.reset());
      if (!memoName && defaultVisibility) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility, entryType }));
      }
      // Re-seed the calendar-derived timestamps so the popover stays visible
      // and subsequent memos in the same filter session keep the prefilled date.
      // Without this, the live-sync effect won't re-fire (its deps don't change
      // across reset), and memo #2 onward would silently fall back to "now".
      if (!memoName && defaultCreateTime) {
        dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
      }

      // Surface a freshly created top-level memo at the top of the list so it
      // stays visible even when pinned memos would otherwise push it down.
      if (!memoName && !parentMemoName) {
        markNewMemo(result.memoName);
      }

      // Notify parent component of successful save
      onConfirm?.(result.memoName);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to save memo",
        fallbackMessage: errorService.getErrorMessage(error),
      });
    } finally {
      dispatch(actions.setLoading("saving", false));
    }
  }

  return (
    <>
      <FocusModeOverlay isActive={isFocusMode} onToggle={handleToggleFocusMode} />

      {/*
        Layout structure:
        - Uses justify-between to push content to top and bottom
        - In focus mode: becomes fixed with specific spacing, editor grows to fill space
        - In normal mode: stays relative with max-height constraint
      */}
      <div
        className={cn(
          "group relative w-full flex flex-col justify-between items-start bg-card px-4 pt-3 pb-1 rounded-lg border border-border gap-2",
          FOCUS_MODE_STYLES.transition,
          isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
          className,
        )}
      >
        {header ? <div className="w-full">{header}</div> : null}

        {/* Focus-mode header: the formatting toolbar (exit lives in it). */}
        {isFocusMode && (
          <FormattingToolbar controllerRef={editorRef} onExit={handleToggleFocusMode} className={FOCUS_MODE_STYLES.formattingHeader} />
        )}

        {(memoName || (!memo && hasTimestamp)) && (
          <div className="w-full -mb-1">
            <TimestampPopover />
          </div>
        )}

        {/* Editor content grows to fill available space in focus mode */}
        <EditorContent ref={editorRef} placeholder={placeholder} />

        {isAudioRecorderOpen && audioRecorder.isBusy && (
          <AudioRecorderPanel
            audioRecorder={{ status: audioRecorder.status, elapsedSeconds: audioRecorder.elapsedSeconds }}
            mediaStream={audioRecorder.recordingStream}
            onStop={audioRecorder.stopRecording}
            onCancel={handleCancelAudioRecording}
          />
        )}

        {/* Metadata and toolbar grouped together at bottom */}
        <div className="w-full flex flex-col gap-2">
          <EditorMetadata memoName={memoName} />
          <EditorToolbar
            onSave={handleSave}
            onCancel={onCancel}
            memoName={memoName}
            onAudioRecorderClick={handleAudioRecorderClick}
            visibilityOptions={visibilityOptions}
            showVisibilitySelector={showVisibilitySelector}
          />
        </div>
      </div>
    </>
  );
};

export default MemoEditor;

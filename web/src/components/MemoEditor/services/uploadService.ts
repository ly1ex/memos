import { attachmentApi } from "@/api/client";
import type { Attachment } from "@/api/types";
import { AttachmentSchema, createMessage, MotionMediaSchema } from "@/api/types";
import type { LocalFile } from "../types/attachment";

export const uploadService = {
  async uploadFiles(localFiles: LocalFile[]): Promise<Attachment[]> {
    if (localFiles.length === 0) return [];

    const attachments: Attachment[] = [];

    for (const localFile of localFiles) {
      const { file, motionMedia } = localFile;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const attachment = await attachmentApi.createAttachment({
        attachment: createMessage(AttachmentSchema, {
          filename: file.name,
          size: BigInt(file.size),
          type: file.type,
          content: buffer,
          motionMedia: motionMedia ? createMessage(MotionMediaSchema, motionMedia) : undefined,
        }),
      });
      attachments.push(attachment);
    }

    return attachments;
  },
};

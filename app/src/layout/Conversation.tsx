import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ReactHtmlParser from "react-html-parser";
import { CommentOnConversation } from "@/layout/Comment";
import ContentBox from "@/layout/ContentBox";
import RichInput from "@/layout/RichInput";
import Loader from "@/layout/Loader";
import { useUserData } from "@/utils/UserContext";
import { api } from "@/utils/api";
import { show_toast } from "@/libs/toast";
import { mutateCommentSchema } from "../validators/comments";
import { useInfinitePagination } from "@/libs/pagination";
import type { MutateCommentSchema } from "../validators/comments";

interface ConversationProps {
  convo_title?: string;
  convo_id?: string;
  refreshKey: number;
  title: string;
  subtitle: string;
  initialBreak?: boolean;
  topRightContent?: React.ReactNode;
}

const Conversation: React.FC<ConversationProps> = (props) => {
  const { data: userData, pusher } = useUserData();
  const [lastElement, setLastElement] = useState<HTMLDivElement | null>(null);
  const [editorKey, setEditorKey] = useState<number>(0);

  const {
    data: comments,
    fetchNextPage,
    hasNextPage,
    refetch,
    isLoading,
  } = api.comments.getConversationComments.useInfiniteQuery(
    {
      convo_id: props.convo_id,
      convo_title: props.convo_title,
      limit: 10,
      refreshKey: props.refreshKey,
    },
    {
      enabled: props.convo_id !== undefined || props.convo_title !== undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      keepPreviousData: true,
      staleTime: Infinity,
    },
  );
  const allComments = comments?.pages.map((page) => page.data).flat();
  const conversation = comments?.pages[0]?.convo;

  useInfinitePagination({ fetchNextPage, hasNextPage, lastElement });

  const {
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<MutateCommentSchema>({
    resolver: zodResolver(mutateCommentSchema),
  });

  useEffect(() => {
    if (conversation) {
      setValue("object_id", conversation.id);
    }
  }, [conversation, setValue]);

  const { mutate: createComment, isLoading: isCommenting } =
    api.comments.createConversationComment.useMutation({
      onSuccess: () => {
        reset();
        setEditorKey((prev) => prev + 1);
      },
      onError: (error) => {
        show_toast("Error on creating new thread", error.message, "error");
      },
    });

  useEffect(() => {
    if (conversation && pusher) {
      const channel = pusher.subscribe(conversation.id);
      channel.bind("event", async () => {
        await refetch();
      });
      return () => {
        pusher.unsubscribe(conversation.id);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  const handleSubmitComment = handleSubmit(
    (data) => createComment(data),
    (errors) => console.error(errors),
  );

  return (
    <div key={props.refreshKey}>
      {isLoading && <Loader explanation="Loading data" />}
      {!isLoading && allComments && allComments.length > 0 && (
        <ContentBox
          title={props.title}
          subtitle={props.subtitle}
          initialBreak={props.initialBreak}
          topRightContent={props.topRightContent}
        >
          {conversation && !conversation.isLocked && userData && !userData.isBanned && (
            <div className="relative mb-2">
              <RichInput
                id="comment"
                refreshKey={editorKey}
                height="120"
                disabled={isCommenting}
                placeholder=""
                control={control}
                error={errors.comment?.message}
                onSubmit={handleSubmitComment}
              />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-row-reverse">
                {isCommenting && <Loader />}
              </div>
            </div>
          )}
          {allComments.map((comment, i) => {
            return (
              <div
                key={comment.id}
                ref={i === allComments.length - 1 ? setLastElement : null}
              >
                <CommentOnConversation
                  user={comment}
                  hover_effect={false}
                  comment={comment}
                  refetchComments={async () => await refetch()}
                >
                  {ReactHtmlParser(comment.content)}
                </CommentOnConversation>
              </div>
            );
          })}
        </ContentBox>
      )}
    </div>
  );
};

export default Conversation;

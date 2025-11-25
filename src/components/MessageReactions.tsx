import { useState } from 'react';
import { Smile, Plus } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface Reaction {
  emoji: string;
  users: string[];
  count: number;
}

interface MessageReactionsProps {
  messageId: string;
  reactions: Record<string, Reaction>;
  currentUsername: string;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  isOwnMessage: boolean;
}

export function MessageReactions({
  messageId,
  reactions,
  currentUsername,
  onAddReaction,
  onRemoveReaction,
  isOwnMessage
}: MessageReactionsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const reaction = reactions[emoji];
    
    if (reaction && reaction.users.includes(currentUsername)) {
      onRemoveReaction(messageId, emoji);
    } else {
      onAddReaction(messageId, emoji);
    }
    
    setIsPickerOpen(false);
  };

  const handleReactionClick = (emoji: string) => {
    const reaction = reactions[emoji];
    if (reaction.users.includes(currentUsername)) {
      onRemoveReaction(messageId, emoji);
    } else {
      onAddReaction(messageId, emoji);
    }
  };

  const reactionEntries = Object.entries(reactions);

  return (
    <div className={cn(
      "flex flex-wrap gap-1.5 mt-1",
      isOwnMessage ? "justify-end" : "justify-start"
    )}>
      {/* Existing Reactions */}
      {reactionEntries.map(([emoji, reaction]) => {
        const hasReacted = reaction.users.includes(currentUsername);
        
        return (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className={cn(
              "group inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              "transition-all duration-200 hover:scale-110 animate-message-in",
              "border shadow-sm",
              hasReacted
                ? "bg-primary/20 border-primary/40 text-primary hover:bg-primary/30"
                : "bg-card border-border hover:bg-accent hover:border-accent-foreground/20"
            )}
            title={reaction.users.join(', ')}
          >
            <span className="text-base leading-none">{emoji}</span>
            <span className={cn(
              "text-xs font-semibold transition-colors",
              hasReacted ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}>
              {reaction.count}
            </span>
          </button>
        );
      })}

      {/* Add Reaction Button */}
      <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-all",
              "hover:bg-accent hover:scale-110 border border-transparent hover:border-border",
              reactionEntries.length > 0 && "opacity-60"
            )}
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-full p-0 border-0 shadow-2xl"
          align={isOwnMessage ? "end" : "start"}
          sideOffset={5}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width="100%"
            height={400}
            searchPlaceHolder="Search emoji..."
            previewConfig={{ showPreview: false }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

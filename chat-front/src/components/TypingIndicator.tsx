import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TypingIndicatorProps {
  username: string;
  avatarColor: string;
}

export function TypingIndicator({ username, avatarColor }: TypingIndicatorProps) {
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex gap-3 animate-message-in">
      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 border-2 border-background shadow-md">
        <AvatarFallback className={`bg-gradient-to-br ${avatarColor} text-white font-bold text-xs sm:text-sm`}>
          {getInitials(username)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start">
        <span className="text-xs font-semibold text-muted-foreground mb-1 px-1">
          {username}
        </span>
        <div className="message-received rounded-2xl rounded-tl-sm border border-border/50 px-4 py-3 shadow-sm">
          <div className="flex gap-1.5 items-center">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        <span className="text-xs text-muted-foreground mt-1 px-1">
          typing...
        </span>
      </div>
    </div>
  );
}

import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ReadReceiptsProps {
  readBy: string[];
  currentUsername: string;
  isOwnMessage: boolean;
  getInitials: (name: string) => string;
  getAvatarColor: (name: string) => string;
}

export function ReadReceipts({ readBy, currentUsername, isOwnMessage, getInitials, getAvatarColor }: ReadReceiptsProps) {
  // Filter out current user from readBy list
  const otherReaders = readBy.filter(user => user !== currentUsername);
  
  if (!isOwnMessage || otherReaders.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 hover:opacity-80 transition-opacity">
            {otherReaders.length === 1 ? (
              <Check className="w-3 h-3 text-primary animate-in fade-in" />
            ) : (
              <CheckCheck className="w-3 h-3 text-primary animate-in fade-in" />
            )}
            <span className="text-xs text-muted-foreground">
              {otherReaders.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Read by {otherReaders.length} {otherReaders.length === 1 ? 'user' : 'users'}
            </p>
            <div className="flex flex-wrap gap-2">
              {otherReaders.map((user, idx) => (
                <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-accent/50">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className={`text-white font-semibold text-xs ${getAvatarColor(user)}`}>
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{user}</span>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

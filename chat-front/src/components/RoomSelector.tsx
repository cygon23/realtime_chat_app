import React, { useState } from 'react';
import { Plus, Hash, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Room {
  id: string;
  name: string;
  userCount: number;
}

interface RoomSelectorProps {
  rooms: Room[];
  currentRoom: Room | null;
  onCreateRoom: (roomName: string) => void;
  onJoinRoom: (roomId: string) => void;
  onBack?: () => void;
}

export function RoomSelector({ rooms, currentRoom, onCreateRoom, onJoinRoom, onBack }: RoomSelectorProps) {
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateRoom = () => {
    if (newRoomName.trim()) {
      onCreateRoom(newRoomName.trim());
      setNewRoomName('');
      setShowCreateForm(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateRoom();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-lg">
        <div className="flex items-center justify-between mb-3">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Chat Rooms
            </h2>
            <p className="text-sm text-muted-foreground">
              {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} available
            </p>
          </div>
        </div>

        {/* Create Room Form */}
        {showCreateForm ? (
          <div className="space-y-2 animate-fade-in">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Room name (e.g., General)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyPress={handleKeyPress}
                maxLength={30}
                className="flex-1 h-10"
                autoFocus
              />
              <Button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim()}
                size="sm"
                className="gap-2"
              >
                Create
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateForm(false);
                setNewRoomName('');
              }}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="w-full gap-2 bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Create New Room
          </Button>
        )}
      </div>

      {/* Rooms List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {rooms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Hash className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm">
                No rooms yet. Create one to start chatting!
              </p>
            </div>
          )}

          {rooms.map((room, idx) => (
            <Card
              key={room.id}
              className={`
                cursor-pointer transition-all duration-200 hover:shadow-md animate-slide-in-right
                ${currentRoom?.id === room.id 
                  ? 'border-primary/50 bg-gradient-to-r from-primary/10 to-primary-glow/10 shadow-md' 
                  : 'hover:bg-accent/50'
                }
              `}
              style={{ animationDelay: `${idx * 0.05}s` }}
              onClick={() => onJoinRoom(room.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`
                      p-2 rounded-lg shrink-0
                      ${currentRoom?.id === room.id 
                        ? 'bg-gradient-to-br from-primary to-primary-glow' 
                        : 'bg-accent'
                      }
                    `}>
                      <Hash className={`w-5 h-5 ${currentRoom?.id === room.id ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{room.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>{room.userCount} {room.userCount === 1 ? 'user' : 'users'}</span>
                      </div>
                    </div>
                  </div>
                  {currentRoom?.id === room.id && (
                    <Badge className="bg-primary text-primary-foreground">
                      Current
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

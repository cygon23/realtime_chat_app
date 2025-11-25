import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Circle, LogOut, MessageSquare, Menu, X, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { TypingIndicator } from '@/components/TypingIndicator';
import { MessageReactions, Reaction } from '@/components/MessageReactions';
import { ReadReceipts } from '@/components/ReadReceipts';
import { RoomSelector } from '@/components/RoomSelector';
import { Auth } from '@/components/Auth';
import { toast } from '@/hooks/use-toast';
import { supabase, Profile, Room, Message as DBMessage } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatMessage extends DBMessage {
  reactions: Record<string, Reaction>;
  readBy: string[];
  username?: string;
}

interface RoomWithCount extends Room {
  userCount: number;
}

export default function ChatApp() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomWithCount | null>(null);
  const [rooms, setRooms] = useState<RoomWithCount[]>([]);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Profile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user profile
  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }

    setProfile(data);
    setShowRoomSelector(true);
    loadRooms();
  };

  // Load available rooms
  const loadRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading rooms:', error);
      return;
    }

    // Get member counts for each room
    const roomsWithCounts = await Promise.all(
      data.map(async (room) => {
        const { count } = await supabase
          .from('room_members')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id);

        return {
          ...room,
          userCount: count || 0,
        };
      })
    );

    setRooms(roomsWithCounts);
  };

  // Create a new room
  const handleCreateRoom = async (roomName: string) => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name: roomName,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating room:', error);
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Room Created",
      description: `Room "${roomName}" has been created`,
    });

    loadRooms();
  };

  // Join a room
  const handleJoinRoom = async (roomId: string) => {
    if (!profile) return;

    // Add user to room_members
    const { error: memberError } = await supabase
      .from('room_members')
      .upsert({
        room_id: roomId,
        user_id: profile.id,
      });

    if (memberError) {
      console.error('Error joining room:', memberError);
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive",
      });
      return;
    }

    // Find the room
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    setCurrentRoom(room);
    setMessages([]);
    setShowRoomSelector(false);

    // Load room messages
    loadMessages(roomId);

    // Setup realtime channel
    setupRealtimeChannel(roomId);

    toast({
      title: "Joined Room",
      description: `You joined "${room.name}"`,
    });
  };

  // Load messages for a room
  const loadMessages = async (roomId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles:user_id (username)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    // Load reactions and read receipts for each message
    const messagesWithData = await Promise.all(
      data.map(async (msg) => {
        // Load reactions
        const { data: reactions } = await supabase
          .from('message_reactions')
          .select('*, profiles:user_id (username)')
          .eq('message_id', msg.id);

        // Load read receipts
        const { data: receipts } = await supabase
          .from('read_receipts')
          .select('*, profiles:user_id (username)')
          .eq('message_id', msg.id);

        // Group reactions by emoji
        const groupedReactions: Record<string, Reaction> = {};
        reactions?.forEach((reaction) => {
          if (!groupedReactions[reaction.emoji]) {
            groupedReactions[reaction.emoji] = {
              emoji: reaction.emoji,
              users: [],
              count: 0,
            };
          }
          groupedReactions[reaction.emoji].users.push(reaction.profiles.username);
          groupedReactions[reaction.emoji].count++;
        });

        return {
          ...msg,
          username: msg.profiles.username,
          reactions: groupedReactions,
          readBy: receipts?.map(r => r.profiles.username) || [],
        };
      })
    );

    setMessages(messagesWithData);
  };

  // Setup realtime channel for room
  const setupRealtimeChannel = (roomId: string) => {
    // Cleanup existing channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: profile?.id,
        },
      },
    });

    // Listen to new messages
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMessage = payload.new as DBMessage;
          
          // Fetch username
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', newMessage.user_id)
            .single();

          const message: ChatMessage = {
            ...newMessage,
            username: profileData?.username,
            reactions: {},
            readBy: [],
          };

          setMessages((prev) => [...prev, message]);

          // Send read receipt if not own message
          if (newMessage.user_id !== profile?.id) {
            await supabase.from('read_receipts').insert({
              message_id: newMessage.id,
              user_id: profile?.id,
            });
          }
        }
      )
      // Listen to reactions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
        },
        async (payload) => {
          const reaction = payload.new as any;
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', reaction.user_id)
            .single();

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === reaction.message_id) {
                const reactions = { ...msg.reactions };
                const emoji = reaction.emoji;

                if (reactions[emoji]) {
                  if (!reactions[emoji].users.includes(profileData?.username)) {
                    reactions[emoji] = {
                      emoji,
                      users: [...reactions[emoji].users, profileData?.username],
                      count: reactions[emoji].count + 1,
                    };
                  }
                } else {
                  reactions[emoji] = {
                    emoji,
                    users: [profileData?.username],
                    count: 1,
                  };
                }

                return { ...msg, reactions };
              }
              return msg;
            })
          );
        }
      )
      // Listen to reaction removals
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const reaction = payload.old as any;

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === reaction.message_id) {
                const reactions = { ...msg.reactions };
                const emoji = reaction.emoji;

                if (reactions[emoji]) {
                  reactions[emoji].count--;
                  if (reactions[emoji].count === 0) {
                    delete reactions[emoji];
                  }
                }

                return { ...msg, reactions };
              }
              return msg;
            })
          );
        }
      )
      // Presence for online users
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat() as any[];
        
        const uniqueUsers = users.reduce((acc: Profile[], user: any) => {
          if (!acc.find(u => u.id === user.id)) {
            acc.push(user);
          }
          return acc;
        }, []);

        setOnlineUsers(uniqueUsers);
      })
      // Typing indicators via broadcast
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.username !== profile?.username) {
          setTypingUsers((prev) => new Set(prev).add(payload.username));
        }
      })
      .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(payload.username);
          return newSet;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          await channel.track({
            id: profile?.id,
            username: profile?.username,
            status: 'online',
          });
        }
      });

    channelRef.current = channel;
  };

  // Send a message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentRoom || !profile) return;

    // Send stop typing
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'stop_typing',
        payload: { username: profile.username },
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const { error } = await supabase.from('messages').insert({
      room_id: currentRoom.id,
      user_id: profile.id,
      content: inputMessage.trim(),
    });

    if (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      return;
    }

    setInputMessage('');
  };

  // Handle typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    if (e.target.value.length > 0 && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { username: profile?.username },
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'stop_typing',
            payload: { username: profile?.username },
          });
        }
      }, 2000);
    }
  };

  // Add reaction
  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;

    const { error } = await supabase.from('message_reactions').insert({
      message_id: messageId,
      user_id: profile.id,
      emoji,
    });

    if (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Remove reaction
  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;

    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', profile.id)
      .eq('emoji', emoji);

    if (error) {
      console.error('Error removing reaction:', error);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setCurrentRoom(null);
    setMessages([]);
    setShowRoomSelector(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-red-500 to-red-600',
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-yellow-500 to-yellow-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-teal-500 to-teal-600',
      'from-orange-500 to-orange-600',
      'from-cyan-500 to-cyan-600',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Auth Screen
  if (!session || !profile) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  // Room Selector Screen
  if (showRoomSelector) {
    return (
      <div className="min-h-screen chat-gradient-bg">
        <div className="h-screen max-w-4xl mx-auto">
          <RoomSelector
            rooms={rooms}
            currentRoom={currentRoom}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onBack={handleSignOut}
          />
        </div>
      </div>
    );
  }

  // Main Chat Interface
  return (
    <div className="h-screen flex chat-gradient-bg overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-80 bg-sidebar-bg border-r border-border/50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-2xl lg:shadow-none
      `}>
        <div className="p-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Online Users</h2>
                <p className="text-xs text-muted-foreground">
                  {onlineUsers.length} {onlineUsers.length === 1 ? 'user' : 'users'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-sidebar-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <Badge variant="default" className="gap-1.5 bg-gradient-to-r from-primary to-primary-glow">
            <Circle className="w-2 h-2 fill-current animate-pulse-glow" />
            Connected
          </Badge>
        </div>

        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {onlineUsers.map((user, idx) => (
              <div
                key={user.id}
                className={`
                  flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                  ${user.id === profile?.id 
                    ? 'bg-gradient-to-r from-primary/10 to-primary-glow/10 border border-primary/30 shadow-md' 
                    : 'hover:bg-sidebar-hover'
                  }
                  animate-slide-in-right
                `}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <Avatar className="h-11 w-11 border-2 border-background shadow-md">
                  <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(user.username)} text-white font-bold text-sm`}>
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user.username}
                  </p>
                  {user.id === profile?.id && (
                    <p className="text-xs text-primary font-medium">You</p>
                  )}
                </div>
                {user.id === profile?.id && (
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse-glow" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-card/50 backdrop-blur-sm">
          <Button 
            onClick={handleSignOut}
            variant="outline" 
            className="w-full gap-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all"
          >
            <LogOut className="w-4 h-4" />
            Leave Chat
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 border-b border-border/50 bg-card/80 backdrop-blur-lg shadow-sm flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-sidebar-hover rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {currentRoom && (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-primary to-primary-glow rounded-lg">
                    <Hash className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h1 className="text-xl font-bold">{currentRoom.name}</h1>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Welcome, <span className="font-semibold text-primary">{profile?.username}</span>
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRoomSelector(true)}
            className="gap-2 hidden sm:flex"
          >
            <Hash className="w-4 h-4" />
            Rooms
          </Button>

          <Badge variant="outline" className="hidden sm:flex">
            <Users className="w-3 h-3 mr-1" />
            {onlineUsers.length}
          </Badge>
        </div>

        <ScrollArea className="flex-1 p-4 sm:p-6">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground text-sm">
                  No messages yet. Start the conversation!
                </p>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div key={msg.id} className="animate-message-in" style={{ animationDelay: `${index * 0.02}s` }}>
                <div className={`group flex gap-2 sm:gap-3 ${msg.user_id === profile?.id ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 border-2 border-background shadow-md">
                    <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(msg.username || '')} text-white font-bold text-xs sm:text-sm`}>
                      {getInitials(msg.username || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${msg.user_id === profile?.id ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-md`}>
                    {msg.user_id !== profile?.id && (
                      <span className="text-xs font-semibold text-muted-foreground mb-1 px-1">
                        {msg.username}
                      </span>
                    )}
                    <div className={`
                      rounded-2xl px-4 py-2.5 shadow-sm transition-all hover:shadow-md
                      ${msg.user_id === profile?.id 
                        ? 'message-sent rounded-tr-sm' 
                        : 'message-received rounded-tl-sm border border-border/50'
                      }
                    `}>
                      <p className="text-sm break-words leading-relaxed">{msg.content}</p>
                    </div>
                    
                    <MessageReactions
                      messageId={msg.id}
                      reactions={msg.reactions}
                      currentUsername={profile?.username || ''}
                      onAddReaction={handleAddReaction}
                      onRemoveReaction={handleRemoveReaction}
                      isOwnMessage={msg.user_id === profile?.id}
                    />
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground mt-1 px-1">
                        {formatTime(msg.created_at)}
                      </span>
                      <ReadReceipts
                        readBy={msg.readBy || []}
                        currentUsername={profile?.username || ''}
                        isOwnMessage={msg.user_id === profile?.id}
                        getInitials={getInitials}
                        getAvatarColor={getAvatarColor}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {Array.from(typingUsers).map((typingUser) => (
              <TypingIndicator
                key={typingUser}
                username={typingUser}
                avatarColor={getAvatarColor(typingUser)}
              />
            ))}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border/50 bg-card/80 backdrop-blur-lg p-3 sm:p-4 shadow-lg">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <Input
              type="text"
              placeholder="Type your message..."
              value={inputMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base border-2 focus:border-primary transition-all"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              size="lg"
              className="gap-2 h-11 sm:h-12 px-4 sm:px-6 bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg hover:scale-105 transition-all"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
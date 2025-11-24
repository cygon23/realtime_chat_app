import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Circle, LogOut, MessageSquare, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { TypingIndicator } from '@/components/TypingIndicator';
import { MessageReactions, Reaction } from '@/components/MessageReactions';
import { toast } from '@/hooks/use-toast';

interface Message {
  type: 'join' | 'message' | 'leave' | 'user_list' | 'typing' | 'stop_typing' | 'reaction_add' | 'reaction_remove';
  userId?: string;
  username?: string;
  content?: string;
  timestamp?: number;
  users?: string[];
  messageId?: string;
  emoji?: string;
  reactions?: Record<string, Reaction>;
}

interface ChatMessage {
  id: string;
  type: 'message' | 'system';
  username?: string;
  content: string;
  timestamp: number;
  reactions: Record<string, Reaction>;
}

export default function ChatApp() {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
      console.log('Connected to server');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const message: Message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'join':
          setMessages(prev => [...prev, {
            id: `${message.timestamp}-${message.userId}`,
            type: 'system',
            content: `${message.username} joined the chat`,
            timestamp: message.timestamp || Date.now(),
            reactions: {}
          }]);
          break;

        case 'leave':
          setMessages(prev => [...prev, {
            id: `${message.timestamp}-${message.userId}`,
            type: 'system',
            content: `${message.username} left the chat`,
            timestamp: message.timestamp || Date.now(),
            reactions: {}
          }]);
          break;

        case 'message':
          setMessages(prev => [...prev, {
            id: `${message.timestamp}-${message.userId}`,
            type: 'message',
            username: message.username,
            content: message.content || '',
            timestamp: message.timestamp || Date.now(),
            reactions: {}
          }]);
          break;

        case 'reaction_add':
          if (message.messageId && message.emoji && message.username) {
            setMessages(prev => prev.map(msg => {
              if (msg.id === message.messageId) {
                const reactions = { ...msg.reactions };
                const emoji = message.emoji!;
                
                if (reactions[emoji]) {
                  // Add user to existing reaction
                  if (!reactions[emoji].users.includes(message.username!)) {
                    reactions[emoji] = {
                      emoji,
                      users: [...reactions[emoji].users, message.username!],
                      count: reactions[emoji].count + 1
                    };
                  }
                } else {
                  // Create new reaction
                  reactions[emoji] = {
                    emoji,
                    users: [message.username!],
                    count: 1
                  };
                }
                
                return { ...msg, reactions };
              }
              return msg;
            }));
          }
          break;

        case 'reaction_remove':
          if (message.messageId && message.emoji && message.username) {
            setMessages(prev => prev.map(msg => {
              if (msg.id === message.messageId) {
                const reactions = { ...msg.reactions };
                const emoji = message.emoji!;
                
                if (reactions[emoji]) {
                  const updatedUsers = reactions[emoji].users.filter(u => u !== message.username);
                  
                  if (updatedUsers.length === 0) {
                    // Remove reaction entirely if no users left
                    delete reactions[emoji];
                  } else {
                    // Update reaction with remaining users
                    reactions[emoji] = {
                      emoji,
                      users: updatedUsers,
                      count: updatedUsers.length
                    };
                  }
                }
                
                return { ...msg, reactions };
              }
              return msg;
            }));
          }
          break;

        case 'user_list':
          setOnlineUsers(message.users || []);
          break;

        case 'typing':
          if (message.username && message.username !== username) {
            setTypingUsers(prev => new Set(prev).add(message.username!));
          }
          break;

        case 'stop_typing':
          if (message.username) {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(message.username!);
              return newSet;
            });
          }
          break;
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setConnected(false);
      setTimeout(() => {
        if (joined) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  };

  const handleJoin = () => {
    if (username.trim()) {
      connectWebSocket();
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join',
            username: username.trim()
          }));
          setJoined(true);
        }
      }, 100);
    }
  };

  const handleLeave = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setJoined(false);
    setMessages([]);
    setOnlineUsers([]);
    setUsername('');
    setConnected(false);
    setSidebarOpen(false);
    setTypingUsers(new Set());
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
      // Send stop typing event
      wsRef.current.send(JSON.stringify({
        type: 'stop_typing'
      }));
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Send message
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content: inputMessage.trim()
      }));
      setInputMessage('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    
    // Send typing event
    if (wsRef.current?.readyState === WebSocket.OPEN && e.target.value.length > 0) {
      wsRef.current.send(JSON.stringify({
        type: 'typing'
      }));
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to send stop typing event
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'stop_typing'
          }));
        }
      }, 2000); // Stop typing after 2 seconds of inactivity
    }
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction_add',
        messageId,
        emoji
      }));
    }
  };

  const handleRemoveReaction = (messageId: string, emoji: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction_remove',
        messageId,
        emoji
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (joined) {
        handleSendMessage();
      } else {
        handleJoin();
      }
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
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

  // Join Screen
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center chat-gradient-bg p-4 animate-fade-in">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
        </div>
        
        <Card className="w-full max-w-md shadow-2xl glass-effect border-0 animate-message-in relative z-10">
          <CardHeader className="space-y-3 text-center pb-4">
            <div className="flex justify-center mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-glow" />
                <div className="relative p-4 bg-gradient-to-br from-primary to-primary-glow rounded-full shadow-lg">
                  <MessageSquare className="w-12 h-12 text-primary-foreground" />
                </div>
              </div>
            </div>
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Welcome to Chat
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Enter your username to start chatting with others
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                maxLength={20}
                className="h-14 text-lg border-2 focus:border-primary transition-all"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Join {onlineUsers.length > 0 ? `${onlineUsers.length} others` : 'the conversation'}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button 
              onClick={handleJoin}
              disabled={!username.trim()}
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg hover:scale-[1.02] transition-all shadow-md"
              size="lg"
            >
              Join Chat
            </Button>
          </CardFooter>
        </Card>
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
        {/* Sidebar Header */}
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
          
          <Badge 
            variant={connected ? "default" : "destructive"} 
            className={`gap-1.5 ${connected ? 'bg-gradient-to-r from-primary to-primary-glow' : ''}`}
          >
            <Circle className={`w-2 h-2 fill-current ${connected ? 'animate-pulse-glow' : ''}`} />
            {connected ? 'Connected' : 'Reconnecting...'}
          </Badge>
        </div>

        {/* Users List */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {onlineUsers.map((user, idx) => (
              <div
                key={idx}
                className={`
                  flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                  ${user === username 
                    ? 'bg-gradient-to-r from-primary/10 to-primary-glow/10 border border-primary/30 shadow-md' 
                    : 'hover:bg-sidebar-hover'
                  }
                  animate-slide-in-right
                `}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <Avatar className="h-11 w-11 border-2 border-background shadow-md">
                  <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(user)} text-white font-bold text-sm`}>
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user}
                  </p>
                  {user === username && (
                    <p className="text-xs text-primary font-medium">You</p>
                  )}
                </div>
                {user === username && (
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse-glow" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border/50 bg-card/50 backdrop-blur-sm">
          <Button 
            onClick={handleLeave}
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
        {/* Chat Header */}
        <div className="h-16 border-b border-border/50 bg-card/80 backdrop-blur-lg shadow-sm flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-sidebar-hover rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1">
            <h1 className="text-xl font-bold">Chat Room</h1>
            <p className="text-xs text-muted-foreground">
              Welcome, <span className="font-semibold text-primary">{username}</span>
            </p>
          </div>

          <Badge variant="outline" className="hidden sm:flex">
            <Users className="w-3 h-3 mr-1" />
            {onlineUsers.length}
          </Badge>
        </div>

        {/* Messages Area */}
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
                {msg.type === 'system' ? (
                  <div className="flex items-center justify-center my-3">
                    <Badge variant="secondary" className="py-1.5 px-4 text-xs shadow-sm">
                      {msg.content}
                    </Badge>
                  </div>
                ) : (
                  <div className={`group flex gap-2 sm:gap-3 ${msg.username === username ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 border-2 border-background shadow-md">
                      <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(msg.username || '')} text-white font-bold text-xs sm:text-sm`}>
                        {getInitials(msg.username || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${msg.username === username ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-md`}>
                      {msg.username !== username && (
                        <span className="text-xs font-semibold text-muted-foreground mb-1 px-1">
                          {msg.username}
                        </span>
                      )}
                      <div className={`
                        rounded-2xl px-4 py-2.5 shadow-sm transition-all hover:shadow-md
                        ${msg.username === username 
                          ? 'message-sent rounded-tr-sm' 
                          : 'message-received rounded-tl-sm border border-border/50'
                        }
                      `}>
                        <p className="text-sm break-words leading-relaxed">{msg.content}</p>
                      </div>
                      
                      {/* Reactions */}
                      <MessageReactions
                        messageId={msg.id}
                        reactions={msg.reactions}
                        currentUsername={username}
                        onAddReaction={handleAddReaction}
                        onRemoveReaction={handleRemoveReaction}
                        isOwnMessage={msg.username === username}
                      />
                      
                      <span className="text-xs text-muted-foreground mt-1 px-1">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Typing Indicators */}
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

        {/* Message Input */}
        <div className="border-t border-border/50 bg-card/80 backdrop-blur-lg p-3 sm:p-4 shadow-lg">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <Input
              type="text"
              placeholder="Type your message..."
              value={inputMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={!connected}
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base border-2 focus:border-primary transition-all"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !connected}
              size="lg"
              className="gap-2 h-11 sm:h-12 px-4 sm:px-6 bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg hover:scale-105 transition-all"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          {!connected && (
            <p className="text-xs text-destructive text-center mt-2 animate-pulse-glow">
              Reconnecting to server...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

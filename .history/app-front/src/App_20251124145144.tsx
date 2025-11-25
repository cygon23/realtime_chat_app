import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Circle, LogOut, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface Message {
  type: 'join' | 'message' | 'leave' | 'user_list';
  userId?: string;
  username?: string;
  content?: string;
  timestamp?: number;
  users?: string[];
}

interface ChatMessage {
  id: string;
  type: 'message' | 'system';
  username?: string;
  content: string;
  timestamp: number;
}

export default function ChatApp() {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            timestamp: message.timestamp || Date.now()
          }]);
          break;

        case 'leave':
          setMessages(prev => [...prev, {
            id: `${message.timestamp}-${message.userId}`,
            type: 'system',
            content: `${message.username} left the chat`,
            timestamp: message.timestamp || Date.now()
          }]);
          break;

        case 'message':
          setMessages(prev => [...prev, {
            id: `${message.timestamp}-${message.userId}`,
            type: 'message',
            username: message.username,
            content: message.content || '',
            timestamp: message.timestamp || Date.now()
          }]);
          break;

        case 'user_list':
          setOnlineUsers(message.users || []);
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
    setJoined(false);
    setMessages([]);
    setOnlineUsers([]);
    setUsername('');
    setConnected(false);
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content: inputMessage.trim()
      }));
      setInputMessage('');
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
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">Welcome to Chat</CardTitle>
            <CardDescription className="text-base">
              Enter your username to join the conversation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                maxLength={20}
                className="h-12 text-lg"
                autoFocus
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleJoin}
              disabled={!username.trim()}
              className="w-full h-12 text-base"
              size="lg"
            >
              Join Chat
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <Card className="w-80 rounded-none border-t-0 border-l-0 border-b-0 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Online Users</CardTitle>
            </div>
            <Badge variant={connected ? "default" : "destructive"} className="gap-1">
              <Circle className="w-2 h-2 fill-current" />
              {connected ? 'Connected' : 'Offline'}
            </Badge>
          </div>
          <CardDescription>
            {onlineUsers.length} {onlineUsers.length === 1 ? 'user' : 'users'} online
          </CardDescription>
        </CardHeader>
        <Separator />
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {onlineUsers.map((user, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  user === username 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'hover:bg-accent'
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={`text-white font-semibold ${getAvatarColor(user)}`}>
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user}
                  </p>
                  {user === username && (
                    <p className="text-xs text-muted-foreground">You</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <Separator />
        <CardFooter className="p-4">
          <Button 
            onClick={handleLeave}
            variant="outline" 
            className="w-full gap-2"
          >
            <LogOut className="w-4 h-4" />
            Leave Chat
          </Button>
        </CardFooter>
      </Card>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Card className="rounded-none border-t-0 border-l-0 border-r-0">
          <CardHeader>
            <CardTitle className="text-2xl">Chat Room</CardTitle>
            <CardDescription>
              Welcome back, <span className="font-semibold text-foreground">{username}</span>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.type === 'system' ? (
                  <div className="flex items-center justify-center my-4">
                    <Badge variant="secondary" className="py-1.5 px-4">
                      {msg.content}
                    </Badge>
                  </div>
                ) : (
                  <div className={`flex gap-3 ${msg.username === username ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className={`text-white font-semibold text-sm ${getAvatarColor(msg.username || '')}`}>
                        {getInitials(msg.username || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${msg.username === username ? 'items-end' : 'items-start'} max-w-md`}>
                      {msg.username !== username && (
                        <span className="text-xs font-semibold text-muted-foreground mb-1 px-1">
                          {msg.username}
                        </span>
                      )}
                      <Card className={msg.username === username ? 'bg-primary text-primary-foreground' : ''}>
                        <CardContent className="p-3">
                          <p className="text-sm break-words">{msg.content}</p>
                        </CardContent>
                      </Card>
                      <span className="text-xs text-muted-foreground mt-1 px-1">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <Card className="rounded-none border-b-0 border-l-0 border-r-0">
          <CardContent className="p-4">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <Input
                type="text"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!connected}
                className="flex-1 h-12"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || !connected}
                size="lg"
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
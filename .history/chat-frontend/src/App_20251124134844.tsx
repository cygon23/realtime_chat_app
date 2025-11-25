import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Circle } from 'lucide-react';

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
    // Change this to your WebSocket server URL
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

  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-indigo-100 rounded-full mb-4">
              <Users className="w-12 h-12 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Join Chat</h1>
            <p className="text-gray-600">Enter your username to start chatting</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your username"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none text-lg"
              maxLength={20}
              autoFocus
            />
            <button
              onClick={handleJoin}
              disabled={!username.trim()}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Join Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Online Users</h2>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Circle className={`w-2 h-2 ${connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
            <span className="text-gray-600">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {onlineUsers.map((user, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${
                user === username ? 'bg-indigo-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold">
                {user.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-700">
                {user} {user === username && '(You)'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h1 className="text-xl font-bold text-gray-800">Chat Room</h1>
          <p className="text-sm text-gray-600">Welcome, {username}!</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.type === 'system' ? (
                <div className="text-center">
                  <span className="text-xs text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              ) : (
                <div className={`flex ${msg.username === username ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md ${
                    msg.username === username
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-800'
                  } rounded-2xl px-4 py-2 shadow`}>
                    {msg.username !== username && (
                      <div className="text-xs font-semibold mb-1 opacity-75">
                        {msg.username}
                      </div>
                    )}
                    <div className="break-words">{msg.content}</div>
                    <div className={`text-xs mt-1 ${
                      msg.username === username ? 'text-indigo-200' : 'text-gray-500'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-indigo-500"
              disabled={!connected}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !connected}
              className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface AuthProps {
  onAuthSuccess: () => void;
}

export function Auth({ onAuthSuccess }: AuthProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!username.trim()) return;

    setLoading(true);
    try {
      // Sign in anonymously
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;

      // Create or update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: username.trim(),
          status: 'online',
        });

      if (profileError) throw profileError;

      toast({
        title: "Welcome!",
        description: `Signed in as ${username}`,
      });

      onAuthSuccess();
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSignIn();
    }
  };

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
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-center">
              Join the conversation
            </p>
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button 
            onClick={handleSignIn}
            disabled={!username.trim() || loading}
            className="w-full h-14 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg hover:scale-[1.02] transition-all shadow-md"
            size="lg"
          >
            {loading ? 'Signing in...' : 'Join Chat'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
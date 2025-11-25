import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { authSchema } from "@/validation/authSchema";


interface AuthProps {
  onAuthSuccess: () => void;
}

export function Auth({ onAuthSuccess }: AuthProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

 const handleAuth = async () => {
  try {
    // ZOD VALIDATION FIRST
    const validatedData = authSchema.parse({
      email,
      password,
      username,
    });

    const { email: vEmail, password: vPassword, username: vUsername } = validatedData;

    setLoading(true);

    let authData;

    if (isSignUp) {
      // Sign up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: vEmail,
        password: vPassword,
      });

      if (signUpError) throw signUpError;

      authData = data;

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    } else {
      // Sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: vEmail,
        password: vPassword,
      });

      if (signInError) throw signInError;

      authData = data;
    }

    // Create/update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: authData.user.id,
        username: vUsername,
        status: "online",
      });

    if (profileError) throw profileError;

    toast({
      title: "Welcome!",
      description: `Signed in as ${vUsername}`,
    });

    onAuthSuccess();
  } catch (error: any) {
    // CATCH ZOD ERRORS
    if (error?.issues) {
      toast({
        title: "Validation Error",
        description: error.issues[0].message,
        variant: "destructive",
      });
      return;
    }

    // NORMAL ERRORS
    toast({
      title: "Error",
      description: error.message || "Authentication failed",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAuth();
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
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className="h-12 text-base border-2 focus:border-primary transition-all"
              autoFocus
              disabled={loading}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className="h-12 text-base border-2 focus:border-primary transition-all"
              disabled={loading}
            />
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={20}
              className="h-12 text-base border-2 focus:border-primary transition-all"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-center">
              {isSignUp ? 'Create an account to get started' : 'Sign in to continue'}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-2">
          <Button 
            onClick={handleAuth}
            disabled={loading}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg hover:scale-[1.02] transition-all shadow-md"
            size="lg"
          >
            {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setIsSignUp(!isSignUp)}
            disabled={loading}
            className="w-full"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
/**
 * Landing Page - Clear value proposition and CTAs for first-time visitors
 */
import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";


import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { useAuth } from "../providers/AuthProvider";
import { WelcomeModal } from "../components/onboarding/WelcomeModal";
import { 
  Sparkles, 
  Gamepad2, 
  Users, 
  Shield, 
  Zap, 
  Globe, 
  MessageSquare, 
  Map, 
  Cpu,
  Play,
  Star,
  ArrowRight,
  CheckCircle,
  Timer,
  Wifi,
  LogIn,
  Dice6
} from "lucide-react";

interface LandingPageProps {
  router: {
    navigate: (path: string, replace?: boolean) => void;
    currentPath: string;
    params?: Record<string, string>;
  };
}

export function LandingPage({ router }: LandingPageProps) {
  const { isAuthenticated } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("vtt-welcome-seen");
    if (!isAuthenticated && !seen) {setShowWelcome(true);}
  }, [isAuthenticated]);

  const completeWelcome = () => {
    localStorage.setItem("vtt-welcome-seen", "true");
    setShowWelcome(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-900 text-white overflow-hidden">
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-24 md:pt-32 md:pb-32 max-w-7xl mx-auto">
        {/* Enhanced background effects */}
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="pointer-events-none absolute left-1/2 top-10 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-purple-700/40 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute right-1/4 top-32 h-64 w-[30rem] rounded-full bg-indigo-600/30 blur-2xl" />
          <div className="pointer-events-none absolute left-1/4 bottom-20 h-48 w-[25rem] rounded-full bg-violet-500/20 blur-xl" />
        </div>

        <div className="flex flex-col items-center text-center gap-8">
          {/* Status badge with animation */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/15 backdrop-blur-sm px-4 py-2 text-sm text-purple-200 animate-fadeInUp">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Live Platform • 1000+ Active Players</span>
          </div>

          {/* Enhanced hero heading */}
          <div className="space-y-4 animate-fadeInUp-delayed">
            <h1 className="text-5xl md:text-7xl font-black leading-[0.9] tracking-tight">
              Epic adventures.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 animate-shimmer">Zero setup.</span>
            </h1>
            <p className="text-gray-300 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
              The most intuitive virtual tabletop for D&D and RPGs. Create epic campaigns, 
              invite friends, and start playing in <span className="text-purple-300 font-semibold">under 60 seconds</span>.
            </p>
          </div>

          {/* Enhanced CTA section */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6 animate-fadeInUp-more-delayed">
            {isAuthenticated ? (
              <Button 
                variant="plasma" 
                size="lg" 
                onClick={() => router.navigate("/dashboard")}
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="plasma" 
                  size="lg" 
                  onClick={() => router.navigate("/register")}
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                >
                  Start Playing Free
                </Button>
                <Button 
                  onClick={() => router.navigate("/login")}
                >
                  Watch Demo
                </Button>
              </>
            )}
          </div>

          {/* Social proof */}
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-8 text-sm text-gray-400 animate-fadeInUp-most-delayed">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 border-2 border-gray-900 flex items-center justify-center text-xs font-bold">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span>Join 10,000+ players</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-1">4.9/5 rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features with enhanced design */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Everything you need to run
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400"> epic campaigns</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Professional-grade tools that feel effortless. No complex setup, no learning curve—just pure gaming magic.
          </p>
        </div>

        {/* Primary features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card variant="elevated" interactive className="group hover:border-purple-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Gamepad2 className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-white text-xl">Real-time VTT</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              Dynamic maps, animated tokens, fog of war, and integrated chat. Everything syncs instantly across all devices.
            </CardContent>
          </Card>

          <Card variant="elevated" interactive className="group hover:border-purple-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-white text-xl">Instant Multiplayer</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              Share a link, and friends join instantly. No downloads, no accounts required for players. Just click and play.
            </CardContent>
          </Card>

          <Card variant="elevated" interactive className="group hover:border-purple-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-white text-xl">Private & Secure</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              Your campaigns are yours. End-to-end encryption, private by default, with granular privacy controls.
            </CardContent>
          </Card>
        </div>

        {/* Secondary features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Map className="h-4 w-4 text-orange-400" />
              </div>
              <h3 className="font-semibold text-white">Smart Grid</h3>
            </div>
            <p className="text-sm text-gray-400">Intelligent snap-to-grid with measurement tools and dynamic lighting.</p>
          </div>

          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-white">Rich Chat</h3>
            </div>
            <p className="text-sm text-gray-400">Voice notes, dice rolling, character sheets, and initiative tracking.</p>
          </div>

          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Zap className="h-4 w-4 text-yellow-400" />
              </div>
              <h3 className="font-semibold text-white">Ultra-fast</h3>
            </div>
            <p className="text-sm text-gray-400">Sub-50ms latency worldwide with edge computing and smart caching.</p>
          </div>

          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                <Wifi className="h-4 w-4 text-pink-400" />
              </div>
              <h3 className="font-semibold text-white">Always Online</h3>
            </div>
            <p className="text-sm text-gray-400">99.9% uptime with automatic saves and offline mode support.</p>
          </div>
        </div>

        {/* Enhanced CTA */}
        <div className="text-center">
          <div className="inline-flex flex-col sm:flex-row gap-4">
            {isAuthenticated ? (
              <Button 
                variant="plasma" 
                size="lg" 
                onClick={() => router.navigate("/dashboard")}
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                Open Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="plasma" 
                  size="lg" 
                  onClick={() => router.navigate("/register")}
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                >
                  Start Your First Campaign
                </Button>
                <Button 
                  variant="neural" 
                  size="lg" 
                  onClick={() => router.navigate("/login")}
                >
                  Sign In
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-4">Free forever • No credit card required • Start in 30 seconds</p>
        </div>
      </section>

      {/* Social proof section */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-2xl p-8 md:p-12 backdrop-blur-sm border border-white/10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Trusted by DMs and players worldwide
            </h2>
            <p className="text-xl text-gray-400">Join thousands of campaigns running on our platform</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">10,000+</div>
              <div className="text-gray-300">Active Players</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-400 mb-2">2,500+</div>
              <div className="text-gray-300">Campaigns Created</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-violet-400 mb-2">50,000+</div>
              <div className="text-gray-300">Hours Played</div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 mb-4">
                "This is hands down the best virtual tabletop I've used. The setup is instant and the experience is flawless."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                  S
                </div>
                <div>
                  <div className="text-white font-medium">Sarah Chen</div>
                  <div className="text-sm text-gray-400">DM for 8 years</div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 mb-4">
                "Finally, a VTT that doesn't require a computer science degree. My players were online and ready in minutes."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                  M
                </div>
                <div>
                  <div className="text-white font-medium">Marcus Rodriguez</div>
                  <div className="text-sm text-gray-400">Player & DM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome Modal for first-time visitors */}
      <WelcomeModal isOpen={showWelcome} onClose={completeWelcome} onComplete={completeWelcome} />
    </div>
  );
}

export default LandingPage;

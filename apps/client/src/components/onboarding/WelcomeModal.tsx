/**
 * Welcome Modal - First-time user onboarding experience
 */
import React, { useState } from "react";
import { Button } from "../ui/Button";
import { 
  Users, 
  Gamepad2, 
  Crown, 
  Play, 
  ArrowRight, 
  ArrowLeft,
  X,
  Sparkles,
  Shield,
  Zap
} from "lucide-react";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export function WelcomeModal({ isOpen, onClose, onComplete }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to Virtual Tabletop",
      description: "Your digital gateway to immersive tabletop gaming",
      icon: <Sparkles className="h-8 w-8 text-purple-400" />,
      content: (
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-32 h-32 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
            <Gamepad2 className="h-16 w-16 text-white" />
            <div className="absolute inset-0 rounded-full animate-pulse bg-purple-400/20"></div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Ready to embark on epic adventures?</h3>
            <p className="text-gray-300 max-w-md mx-auto">
              Connect with friends, create memorable stories, and bring your tabletop campaigns to life with our powerful digital platform.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <p className="text-sm text-gray-400">Multiplayer</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
              <p className="text-sm text-gray-400">Secure</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Zap className="h-6 w-6 text-yellow-400" />
              </div>
              <p className="text-sm text-gray-400">Real-time</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "join-games",
      title: "Join Existing Games",
      description: "Jump into ongoing adventures with other players",
      icon: <Users className="h-8 w-8 text-blue-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="relative mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mb-4">
              <Users className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Find Your Adventure</h3>
            <p className="text-gray-300">
              Browse public game sessions and join the fun instantly. No account required to get started!
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded border border-gray-600">
              <div>
                <h4 className="font-medium text-white">Lost Mines of Phandelver</h4>
                <p className="text-sm text-gray-400">D&D 5e • 2/4 players • Beginner friendly</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs text-green-400">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded border border-gray-600">
              <div>
                <h4 className="font-medium text-white">Cyberpunk Red Campaign</h4>
                <p className="text-sm text-gray-400">Cyberpunk • 0/5 players • Looking for players</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-xs text-yellow-400">Waiting</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-400">
              👆 Simply click "Join Game" on any public session to start playing
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "create-games",
      title: "Create Your Own Games",
      description: "Become a Game Master and lead your own campaigns",
      icon: <Crown className="h-8 w-8 text-yellow-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="relative mx-auto w-24 h-24 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mb-4">
              <Crown className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Be the Game Master</h3>
            <p className="text-gray-300">
              Create and manage your own campaigns with powerful GM tools and invite your friends.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Gamepad2 className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="font-medium text-white mb-1">Campaign Tools</h4>
              <p className="text-xs text-gray-400">Maps, tokens, dice, and more</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <h4 className="font-medium text-white mb-1">Player Management</h4>
              <p className="text-xs text-gray-400">Invite and organize players</p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Shield className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-blue-300">Account Required</h4>
                <p className="text-sm text-blue-200/80">Sign up to create and manage your own games</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "get-started",
      title: "Ready to Begin?",
      description: "Choose how you'd like to start your adventure",
      icon: <Play className="h-8 w-8 text-green-400" />,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <div className="relative mx-auto w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4">
              <Play className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Choose Your Path</h3>
            <p className="text-gray-300">
              You're all set! Pick how you'd like to begin your tabletop adventure.
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-purple-400" />
                  <div>
                    <h4 className="font-medium text-white">Browse Public Games</h4>
                    <p className="text-sm text-gray-400">Join an existing session immediately</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-purple-400" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="h-6 w-6 text-yellow-400" />
                  <div>
                    <h4 className="font-medium text-white">Create Account & Host</h4>
                    <p className="text-sm text-gray-400">Sign up to create your own games</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-gray-500">
              You can always create an account later to unlock more features
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (isFirstStep) {return;}
    setCurrentStep(prev => prev - 1);
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isOpen || !currentStepData) {return null;}

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 border-b border-gray-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-3">
            {currentStepData.icon}
            <div>
              <h2 className="text-lg font-bold text-white">{currentStepData.title}</h2>
              <p className="text-sm text-gray-400">{currentStepData.description}</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 mt-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? "bg-purple-500" : "bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px] flex flex-col justify-center">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {currentStep + 1} of {steps.length}
            </span>
            {!isLastStep && (
              <button
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-white transition-colors underline underline-offset-2"
              >
                Skip tour
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
                onClick={handlePrevious}
              >
                Back
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              rightIcon={!isLastStep ? <ArrowRight className="h-4 w-4" /> : undefined}
              onClick={handleNext}
            >
              {isLastStep ? "Get Started" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Chat System Component - Real-time messaging for game sessions
 */

import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../../providers/WebSocketProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useGame } from '../../providers/GameProvider';
import { Button } from '../ui/Button';
import { Send, Dice6, Users, Eye, Crown, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatRelativeTime } from '../../lib/format';

export interface ChatMessage {
  id: string;
  type: 'message' | 'roll' | 'system' | 'whisper' | 'ooc';
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    role: 'gm' | 'player' | 'spectator';
  };
  timestamp: string;
  recipients?: string[]; // For whispers
  rollResult?: {
    dice: string;
    total: number;
    individual: number[];
    modifier: number;
  };
}

interface ChatSystemProps {
  className?: string;
}

export const ChatSystem = React.memo(function ChatSystem({ className }: ChatSystemProps): JSX.Element {
  const { user  } = useAuth();
  const { session,  isGM  } = useGame();
  const { send,  subscribe  } = useWebSocket();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'ic' | 'ooc' | 'whisper'>('ic');
  const [whisperTarget, setWhisperTarget] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to chat messages
  useEffect(() => {
    const unsubscribe = subscribe('CHAT_MESSAGE', (message) => {
      const chatMessage = message as ChatMessage;
      setMessages(prev => [...prev, chatMessage]);
      
      // Play sound notification
      if (isSoundEnabled && chatMessage.author.id !== user?.id) {
        const audio = new Audio('/sounds/message.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignore errors
      }
      
      // Update unread count if chat is collapsed
      if (!isExpanded) {
        setUnreadCount(prev => prev + 1);
      }
    });

    return unsubscribe;
  }, [subscribe, isSoundEnabled, user?.id, isExpanded]);

  // Clear unread count when expanding
  useEffect(() => {
    if (isExpanded) {
      setUnreadCount(0);
    }
  }, [isExpanded]);

  const sendMessage = () => {
    if (!newMessage.trim() || !session || !user) return;

    const messageData = {
      type: 'SEND_CHAT_MESSAGE',
      sessionId: session.id,
      content: newMessage.trim(),
      messageType,
      whisperTarget: messageType === 'whisper' ? whisperTarget : undefined
    };

    send(messageData);
    setNewMessage('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickRoll = (dice: string) => {
    if (!session || !user) return;

    const rollData = {
      type: 'ROLL_DICE',
      sessionId: session.id,
      dice,
      public: true
    };

    send(rollData);
  };

  const getMessageTypeColor = (type: ChatMessage['type']) => {
    switch (type) {
      case 'roll': return 'text-accent-primary';
      case 'system': return 'text-warning';
      case 'whisper': return 'text-purple-400';
      case 'ooc': return 'text-text-tertiary';
      default: return 'text-text-primary';
    }
  };

  const getMessageTypeIcon = (type: ChatMessage['type']) => {
    switch (type) {
      case 'roll': return <Dice6 className="h-3 w-3" />;
      case 'system': return <Crown className="h-3 w-3" />;
      case 'whisper': return <Eye className="h-3 w-3" />;
      default: return null;
    }
  };

  const formatMessageContent = (message: ChatMessage) => {
    if (message.type === 'roll' && message.rollResult) {
      const { dice,  total,  individual,  modifier  } = message.rollResult;
      return (
        <div className="space-y-1">
          <p>{message.content}</p>
          <div className="bg-bg-tertiary rounded p-2 font-mono text-sm">
            <div className="flex items-center gap-2">
              <Dice6 className="h-4 w-4 text-accent-primary" />
              <span className="font-semibold">Rolling {dice}</span>
            </div>
            <div className="mt-1">
              Individual: [{individual.join(', ')}]
              {modifier !== 0 && ` + ${modifier}`}
            </div>
            <div className="text-lg font-bold text-accent-primary">
              Total: {total}
            </div>
          </div>
        </div>
      );
    }

    return <p>{message.content}</p>;
  };

  if (!session) {
    return (
      <div className={cn('bg-bg-secondary rounded-lg border border-border-primary p-4', className)}>
        <p className="text-text-secondary text-center">
          Join a game session to access chat
        </p>
      </div>
    );
  }

  return (
    <div className={cn('bg-bg-secondary rounded-lg border border-border-primary flex flex-col', className)} ref={containerRef}>
      {/* Chat Header */}
      <div className="p-3 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:text-accent-primary transition-colors"
            aria-label={isExpanded ? 'Collapse chat' : 'Expand chat'}
          >
            <Users className="h-4 w-4" />
            <span className="font-medium">Chat</span>
            {unreadCount > 0 && (
              <span className="bg-accent-primary text-white text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={cn(
              'p-1 rounded hover:bg-bg-tertiary transition-colors',
              isSoundEnabled ? 'text-text-primary' : 'text-text-tertiary'
            )}
            title={isSoundEnabled ? 'Disable sounds' : 'Enable sounds'}
          >
            {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-96">
            {messages.length === 0 ? (
              <div className="text-center text-text-secondary py-8">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="group">
                  <div className="flex items-start gap-2">
                    {/* Avatar */}
                    <div className="w-6 h-6 rounded-full bg-accent-primary flex items-center justify-center text-xs text-white font-medium flex-shrink-0">
                      {message.author.avatar ? (
                        <img 
                          src={message.author.avatar} 
                          alt={message.author.displayName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        message.author.displayName.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'font-medium text-sm',
                          message.author.role === 'gm' ? 'text-gm-accent' : 'text-text-primary'
                        )}>
                          {message.author.displayName}
                        </span>
                        {message.author.role === 'gm' && (
                          <Crown className="h-3 w-3 text-gm-accent" />
                        )}
                        {getMessageTypeIcon(message.type)}
                        <span className="text-xs text-text-tertiary">
                          {formatRelativeTime(message.timestamp)}
                        </span>
                      </div>
                      
                      <div className={cn('text-sm', getMessageTypeColor(message.type))}>
                        {message.type === 'whisper' && (
                          <span className="text-purple-400 font-medium">
                            [Whisper] 
                          </span>
                        )}
                        {message.type === 'ooc' && (
                          <span className="text-text-tertiary font-medium">
                            [OOC] 
                          </span>
                        )}
                        {formatMessageContent(message)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 border-t border-border-primary">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-text-secondary">Quick Rolls:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickRoll('1d20')}
                className="text-xs h-6 px-2"
              >
                d20
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickRoll('1d100')}
                className="text-xs h-6 px-2"
              >
                d100
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleQuickRoll('4d6')}
                className="text-xs h-6 px-2"
              >
                4d6
              </Button>
            </div>
          </div>

          {/* Message Input */}
          <div className="p-3 border-t border-border-primary">
            <div className="flex items-center gap-2 mb-2">
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value as any)}
                className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1"
              >
                <option value="ic">In Character</option>
                <option value="ooc">Out of Character</option>
                {isGM && <option value="whisper">Whisper</option>}
              </select>
              
              {messageType === 'whisper' && session.players.length > 0 && (
                <select
                  value={whisperTarget}
                  onChange={(e) => setWhisperTarget(e.target.value)}
                  className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1"
                >
                  <option value="">Select target...</option>
                  {session.players.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  messageType === 'whisper' 
                    ? 'Type a whisper...' 
                    : messageType === 'ooc' 
                    ? 'Type an OOC message...'
                    : 'Type a message...'
                }
                className="flex-1 bg-bg-tertiary border border-border-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                disabled={messageType === 'whisper' && !whisperTarget}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={sendMessage}
                disabled={!newMessage.trim() || (messageType === 'whisper' && !whisperTarget)}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Send
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

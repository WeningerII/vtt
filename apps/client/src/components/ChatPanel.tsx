/**
 * ChatPanel Component - Real-time chat interface for tabletop gameplay
 * Essential communication tool for players and GM during sessions
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from '../types/vtt';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { 
  Mic, 
  MicOff, 
  Send, 
  Settings, 
  Users, 
  Volume2, 
  VolumeX, 
  Dice6, 
  ArrowDown 
} from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUser?: string;
  isGM?: boolean;
  muted?: boolean;
  onMuteToggle?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  currentUser,
  isGM = false,
  muted = false,
  onMuteToggle
}) => {
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'message' | 'roll' | 'whisper'>('message');
  const [whisperTarget, setWhisperTarget] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Get unique users for whisper targeting
  const availableUsers = useMemo(() => {
    const users = new Set<string>();
    messages.forEach(msg => {
      if (msg.author && msg.author !== currentUser) {
        users.add(msg.author);
      }
    });
    return Array.from(users);
  }, [messages, currentUser]);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    
    let finalMessage = messageText;
    
    if (messageType === 'roll') {
      finalMessage = `/roll ${messageText}`;
    } else if (messageType === 'whisper' && whisperTarget) {
      finalMessage = `/whisper ${whisperTarget} ${messageText}`;
    }
    
    onSendMessage(finalMessage);
    setMessageText('');
  };

  const handleDiceClick = (dice: string) => {
    setMessageText(dice);
  };

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleClearChat = () => {
    // This would need to be implemented at parent level
    console.log('Clear chat requested');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(timestamp);
  };

  const getMessageClass = (message: ChatMessage) => {
    const baseClass = 'p-3 rounded-lg mb-2 break-words';
    
    switch (message.type) {
      case 'roll':
        return `${baseClass} bg-blue-500/20 border-l-4 border-blue-500`;
      case 'system':
        return `${baseClass} bg-yellow-500/20 border-l-4 border-yellow-500 italic`;
      case 'whisper':
        return `${baseClass} bg-purple-500/20 border-l-4 border-purple-500`;
      default:
        return `${baseClass} bg-white/5`;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-subtle">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4" />
          Chat ({messages.length})
        </h3>
        <Button
          onClick={onMuteToggle}
          leftIcon={muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        >
          {muted ? 'Unmute' : 'Mute'}
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className={getMessageClass(message)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">
                      {message.author}
                    </span>
                    {message.type === 'whisper' && (
                      <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                        whisper
                      </span>
                    )}
                    {message.type === 'roll' && (
                      <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                        dice roll
                      </span>
                    )}
                  </div>
                  <div className="text-gray-200">
                    {message.rollResult ? (
                      <div>
                        <div className="font-mono text-lg">
                          {message.rollResult.dice} → {message.rollResult.result}
                        </div>
                        {message.rollResult.breakdown && (
                          <div className="text-sm text-gray-400">
                            {message.rollResult.breakdown}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.text}</div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 ml-2">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Area */}
      <div className="p-3 border-t border-subtle">
        {/* Message Type Selector */}
        <div className="flex gap-1 mb-2">
          <Button
            onClick={() => setMessageType('message')}
          >
            Chat
          </Button>
          <Button
            onClick={() => setMessageType('roll')}
            leftIcon={<Dice6 className="w-3 h-3" />}
          >
            Roll
          </Button>
          {isGM && availableUsers.length > 0 && (
            <Button
              onClick={() => setMessageType('whisper')}
            >
              Whisper
            </Button>
          )}
        </div>

        {/* Whisper Target Selection */}
        {messageType === 'whisper' && (
          <div className="mb-2">
            <select
              value={whisperTarget}
              onChange={(e) => setWhisperTarget(e.target.value)}
              className="w-full p-2 bg-white/5 border border-white/10 rounded text-white text-sm"
            >
              <option value="">Select target...</option>
              {availableUsers.map(user => (
                <option key={user} value={user} className="bg-gray-800">
                  {user}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              messageType === 'roll' 
                ? 'Enter dice expression (e.g., 1d20+3)...' 
                : messageType === 'whisper'
                ? 'Whisper message...'
                : 'Type a message...'
            }
            className="flex-1"
            disabled={messageType === 'whisper' && !whisperTarget}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || (messageType === 'whisper' && !whisperTarget)}
          >
            Send
          </Button>
          <Button
            onClick={handleScrollToBottom}
            leftIcon={<ArrowDown className="w-4 h-4" />}
          >
            Scroll to Bottom
          </Button>
          <Button
            onClick={handleClearChat}
          >
            Clear Chat
          </Button>
        </div>

        {/* Quick Actions */}
        {messageType === 'roll' && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {['1d20', '1d12', '1d10', '1d8', '1d6', '1d4', '2d6'].map(dice => (
              <Button
                key={dice}
                onClick={() => handleDiceClick(dice)}
              >
                {dice}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;

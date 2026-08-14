import React, { useState } from 'react';
import { MessageItem } from '../types/friday';
import { 
  Mail, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Sparkles, 
  Phone, 
  ArrowUpRight, 
  ExternalLink,
  MapPin,
  Calendar as CalendarIcon,
  Copy,
  Check
} from 'lucide-react';
import { soundEffects } from '../services/audioEffects';

interface CommunicationsTriageProps {
  messages: MessageItem[];
  onUpdateMessages: (messages: MessageItem[]) => void;
  onSpeakReply: (text: string) => void;
  onOpenFullHub?: () => void;
}

export const CommunicationsTriage: React.FC<CommunicationsTriageProps> = ({
  messages,
  onUpdateMessages,
  onSpeakReply,
  onOpenFullHub
}) => {
  const [selectedMsg, setSelectedMsg] = useState<MessageItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);

  const handleSelectMessage = (msg: MessageItem) => {
    setSelectedMsg(msg);
    setReplyText(msg.suggestedReply || '');
    // Mark as read
    onUpdateMessages(messages.map(m => m.id === msg.id ? { ...m, unread: false } : m));
  };

  const handleSendReply = (msgId: string) => {
    if (!replyText.trim()) return;
    soundEffects.playAcknowledge();
    setSentSuccessId(msgId);

    setTimeout(() => {
      setSentSuccessId(null);
      setSelectedMsg(null);
      setReplyText('');
    }, 1500);
  };

  const handleReadAloud = (msg: MessageItem) => {
    let speech = `Message from ${msg.sender} via ${msg.source.toUpperCase()}. `;
    if (msg.subject) speech += `Subject: ${msg.subject}. `;
    speech += `Content: ${msg.content}`;
    if (msg.extractedEntities?.otpCode) {
      speech += ` Verification code is ${msg.extractedEntities.otpCode}.`;
    }
    onSpeakReply(speech);
  };

  const handleCopyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOtp(otp);
    soundEffects.playBeep();
    onSpeakReply(`Copied security code ${otp} to clipboard.`);
    setTimeout(() => setCopiedOtp(null), 2500);
  };

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg">
              <MessageSquare className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                Communications Triage
              </h3>
              <p className="text-[11px] text-zinc-400">Viber, SMS, Messenger & Calls</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-sky-950/60 border border-sky-800/50 text-sky-300 text-xs rounded-full font-mono">
              {messages.filter(m => m.unread).length} New
            </span>
            {onOpenFullHub && (
              <button
                onClick={onOpenFullHub}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-mono transition-colors cursor-pointer"
                title="Open Unified Communications Hub"
              >
                <span>Full Hub</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Message List */}
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => handleSelectMessage(msg)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                selectedMsg?.id === msg.id
                  ? 'bg-zinc-900 border-sky-500/60 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                  : msg.unread
                  ? 'bg-zinc-900/80 border-zinc-700/80 hover:border-zinc-500'
                  : 'bg-zinc-900/30 border-zinc-800/60 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${msg.unread ? 'bg-sky-400' : 'bg-transparent'}`} />
                  <span className="text-xs font-semibold text-zinc-100">{msg.sender}</span>
                  
                  {/* Channel Tag */}
                  <span className={`px-1.5 py-0.2 text-[10px] rounded uppercase font-mono font-semibold ${
                    msg.source === 'sms'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : msg.source === 'viber'
                      ? 'bg-purple-500/20 text-purple-300'
                      : msg.source === 'messenger'
                      ? 'bg-blue-500/20 text-blue-300'
                      : msg.source === 'phone_call'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {msg.source === 'phone_call' ? 'Call' : msg.source}
                  </span>

                  {msg.isVip && (
                    <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded font-mono">
                      VIP
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">{msg.timestamp}</span>
              </div>

              {msg.subject && (
                <p className="text-xs font-medium text-zinc-300 mb-0.5 truncate">{msg.subject}</p>
              )}
              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">{msg.content}</p>

              {/* Extracted OTP or Entities */}
              {msg.extractedEntities?.otpCode && (
                <div className="flex items-center space-x-2 mt-2 pt-1.5 border-t border-zinc-800/50">
                  <span className="text-[10px] text-emerald-400 font-mono">OTP: {msg.extractedEntities.otpCode}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyOtp(msg.extractedEntities!.otpCode!);
                    }}
                    className="text-zinc-400 hover:text-white text-[10px] font-mono cursor-pointer"
                  >
                    {copiedOtp === msg.extractedEntities.otpCode ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Action bar inside item */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/60 text-[11px]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReadAloud(msg);
                  }}
                  className="text-sky-400 hover:text-sky-300 flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Read Aloud</span>
                </button>

                <span className="text-zinc-500 flex items-center">
                  <span>Quick Reply</span>
                  <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Message Reply Modal / Drawer */}
      {selectedMsg && (
        <div className="mt-4 p-3.5 rounded-xl bg-zinc-900/90 border border-sky-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-sky-300">
              Drafting reply to {selectedMsg.sender} via {selectedMsg.source.toUpperCase()}
            </span>
            <button
              onClick={() => setSelectedMsg(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>

          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type or dictate response..."
            className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-sky-500 mb-2 resize-none"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-mono">
              AI Drafted • Ready for executive authorization
            </span>
            <button
              onClick={() => handleSendReply(selectedMsg.id)}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-colors"
            >
              {sentSuccessId === selectedMsg.id ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Dispatched!</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Authorize & Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

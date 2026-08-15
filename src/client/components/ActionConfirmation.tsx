import { useState } from 'react';
import { ShoppingCart, Car, Send, Utensils, Check, X } from 'lucide-react';

export interface ActionIntent {
  category: string;
  service: string;
  action: string;
  items?: any[];
  recipient?: string;
  amount?: number;
  destination?: string;
  spokenConfirmation?: string;
}

export function ActionConfirmation({ intent, onConfirm, onCancel }: {
  intent: ActionIntent;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  
  if (!isOpen || !intent) return null;
  
  const icons = {
    food: Utensils,
    transport: Car,
    payment: Send,
    shopping: ShoppingCart
  };
  
  const Icon = icons[intent.category as keyof typeof icons] || ShoppingCart;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-sky-500/20 rounded-xl border border-sky-500/30">
            <Icon className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white capitalize">{intent.action} {intent.category}</h3>
            <p className="text-sm text-slate-400 font-mono">via {intent.service}</p>
          </div>
        </div>
        
        <div className="bg-slate-950/60 rounded-xl p-4 mb-6 space-y-2 border border-slate-800">
          {intent.items && intent.items.length > 0 && intent.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-300 font-medium">{item.quantity || 1}x {item.name}</span>
              {item.options && <span className="text-slate-500 text-xs">{JSON.stringify(item.options)}</span>}
            </div>
          ))}
          {intent.recipient && (
            <div className="text-sm text-slate-300">To: <span className="text-sky-400 font-semibold">{intent.recipient}</span></div>
          )}
          {intent.amount && (
            <div className="text-sm text-slate-300">Amount: <span className="text-emerald-400 font-semibold">₱{intent.amount}</span></div>
          )}
          {intent.destination && (
            <div className="text-sm text-slate-300">Destination: <span className="text-zinc-200">{intent.destination}</span></div>
          )}
        </div>
        
        <p className="text-xs text-amber-400 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
          <span>You'll need to confirm in the <strong className="capitalize">{intent.service}</strong> app</span>
        </p>
        
        <div className="flex gap-3">
          <button 
            onClick={() => { onConfirm(); setIsOpen(false); }}
            className="flex-1 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] cursor-pointer"
          >
            <Check size={18} /> Confirm
          </button>
          <button 
            onClick={() => { onCancel(); setIsOpen(false); }}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <X size={18} /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionConfirmation;

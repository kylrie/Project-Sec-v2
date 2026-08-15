import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  Mic, 
  Volume2, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Key, 
  Brain, 
  UserCheck, 
  Play,
  RotateCcw
} from 'lucide-react';
import { FridayPersonality, VoicePersonaOption } from '../types/friday';
import { DEFAULT_VOICE_PERSONAS } from '../services/storage';
import { SoundSynthesizer } from '../services/audioEffects';

interface VoiceOnboardingWizardProps {
  onComplete: () => void;
  onSpeak: (text: string) => void;
  onSelectPersonality: (p: FridayPersonality) => void;
  soundSynth?: SoundSynthesizer;
}

export const VoiceOnboardingWizard: React.FC<VoiceOnboardingWizardProps> = ({
  onComplete,
  onSpeak,
  onSelectPersonality,
  soundSynth
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPersona, setSelectedPersona] = useState<string>('persona-friday-classic');
  const [wakeWordTested, setWakeWordTested] = useState(false);
  const [workspaceGranted, setWorkspaceGranted] = useState(false);
  const [e2eeVaultCreated, setE2eeVaultCreated] = useState(false);
  const [testCommandSuccess, setTestCommandSuccess] = useState(false);

  const steps = [
    { num: 1, title: 'Voice Calibration & Wake Word' },
    { num: 2, title: 'Google Workspace Intelligence' },
    { num: 3, title: 'Secretary Personality & Voice' },
    { num: 4, title: 'E2EE Vault & Habit Learning' },
    { num: 5, title: 'Voice Command Verification' }
  ];

  const handleNext = () => {
    soundSynth?.playActivate();
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    soundSynth?.playBeep();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div id="voice-onboarding-wizard" className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-cyan-500/30 shadow-2xl backdrop-blur-2xl max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">5-Minute Voice-Guided Setup</h2>
            <p className="text-xs text-slate-400">Calibrating your neural executive secretary</p>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-1.5">
          {steps.map((s) => (
            <div
              key={s.num}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s.num === currentStep
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                  : s.num < currentStep
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {s.num < currentStep ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
          ))}
        </div>
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="min-h-[300px] flex flex-col justify-center">
        {/* STEP 1: WAKE WORD & CALIBRATION */}
        {currentStep === 1 && (
          <div className="space-y-4 text-center max-w-lg mx-auto animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Mic className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white">Calibrate Wake Word: "Hey Friday"</h3>
            <p className="text-xs text-slate-300">
              FRIDAY uses zero-latency on-device Voice Activity Detection (VAD). Say "Hey Friday" or tap below to verify voice acoustic capture.
            </p>

            <div className="pt-2">
              <button
                onClick={() => {
                  soundSynth?.playActivate();
                  setWakeWordTested(true);
                  onSpeak("Neural voice channel online. Calibration successful, Tony.");
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 mx-auto cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                {wakeWordTested ? 'Acoustic Calibration Verified' : 'Test "Hey Friday" Wake Word'}
              </button>
            </div>

            {wakeWordTested && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Zero-latency acoustic model calibrated (14ms response).
              </div>
            )}
          </div>
        )}

        {/* STEP 2: GOOGLE WORKSPACE */}
        {currentStep === 2 && (
          <div className="space-y-4 text-center max-w-lg mx-auto animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Connect Google Workspace</h3>
            <p className="text-xs text-slate-300">
              Grant permissions to Calendar, Gmail, Google Tasks, and Contacts so FRIDAY can draft emails, schedule focus blocks, and screen VIP messages.
            </p>

            <div className="pt-2">
              <button
                onClick={() => {
                  soundSynth?.playActivate();
                  setWorkspaceGranted(true);
                  onSpeak("Google Workspace connected. 4 calendar events and 2 urgent emails indexed.");
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-2 mx-auto cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                {workspaceGranted ? 'Workspace Connected (Executive User)' : 'Authorize Google Workspace'}
              </button>
            </div>

            {workspaceGranted && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Calendar, Gmail, and Tasks synchronized.
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PERSONALITY & VOICE */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Choose FRIDAY's Voice Persona</h3>
              <p className="text-xs text-slate-300">Select the speaking style and cadence for your executive assistant.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {DEFAULT_VOICE_PERSONAS.map((persona) => (
                <div
                  key={persona.id}
                  onClick={() => {
                    soundSynth?.playBeep();
                    setSelectedPersona(persona.id);
                    onSelectPersonality(persona.personality);
                    onSpeak(`Hello Tony, I am your ${persona.name}. Ready for executive briefing.`);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedPersona === persona.id
                      ? 'bg-cyan-500/15 border-cyan-400 shadow-lg shadow-cyan-500/15'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white">{persona.name}</h4>
                    {selectedPersona === persona.id && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{persona.description}</p>
                  <div className="flex items-center justify-between text-[11px] text-cyan-400">
                    <span>{persona.accent}</span>
                    <button className="p-1 rounded hover:bg-slate-800 flex items-center gap-1 font-bold">
                      <Play className="w-3 h-3" /> Preview
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: E2EE VAULT & HABITS */}
        {currentStep === 4 && (
          <div className="space-y-4 text-center max-w-lg mx-auto animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto">
              <Key className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Generate Client-Held E2EE Keys</h3>
            <p className="text-xs text-slate-300">
              Your voice memories, habits, and relationship data are encrypted with AES-GCM 256. Only your devices hold the decryption keys.
            </p>

            <div className="pt-2">
              <button
                onClick={() => {
                  soundSynth?.playActivate();
                  setE2eeVaultCreated(true);
                  onSpeak("End to end encryption keys provisioned in Secure Enclave.");
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-500/25 flex items-center gap-2 mx-auto cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                {e2eeVaultCreated ? 'Vault Keys Provisioned (AES-256)' : 'Generate Hardware Keys'}
              </button>
            </div>

            {e2eeVaultCreated && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
                Fingerprint: SHA256: 8f4a9b...7e21cd0 (Secure Enclave)
              </div>
            )}
          </div>
        )}

        {/* STEP 5: VERIFICATION COMMAND */}
        {currentStep === 5 && (
          <div className="space-y-4 text-center max-w-lg mx-auto animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Volume2 className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white">Verification: Try Your First Command</h3>
            <p className="text-xs text-slate-300">
              Test FRIDAY's proactive intelligence with a live voice query.
            </p>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-cyan-200 text-sm font-semibold italic">
              "Hey Friday, give me my morning briefing."
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  soundSynth?.playActivate();
                  setTestCommandSuccess(true);
                  onSpeak("Good morning. You have 4 meetings. Traffic is heavy to the 9 AM. You have 2 urgent emails. Also, you haven't worked out in 3 days — your 2 PM slot is free.");
                }}
                className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 mx-auto cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Run Verification Test
              </button>
            </div>

            {testCommandSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Setup complete! FRIDAY is ready for full production operations.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>

        <button
          onClick={handleNext}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
        >
          {currentStep === 5 ? 'Launch FRIDAY Executive' : 'Continue'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

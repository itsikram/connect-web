import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { recoveryApi } from './recoveryApi';
import { useCachedDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import { Banner, Button, Card, Chip, CrisisCard, HeaderIconButton, Icon, Muted, RecoveryPage, SectionHeader, Spinner, VoiceTextArea } from './ui';

// Web port of expo-connect-app/src/screens/recovery/Coach.tsx.
const TOOL_BUTTON_ICONS = {
  breathing: 'weather-windy',
  urge_surf: 'waves',
  reasons: 'heart-outline',
  grounding: 'hand-back-left-outline',
  tape_forward: 'fast-forward-outline',
  distract: 'gamepad-variant-outline',
  call_support: 'phone-outline',
  help: 'lifebuoy',
};

const localMessage = (role, text, mode, extra = {}) => ({
  id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  role,
  mode,
  text,
  risk: 'none',
  suggestedTool: 'none',
  crisis: null,
  createdAt: new Date().toISOString(),
  ...extra,
});

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

const RecoveryCoach = () => {
  const navigation = useRecoveryNavigation();
  const params = useLocation().state || {};
  const { lang, s } = useRecoveryI18n();
  const dashboard = useCachedDashboard();
  const mode = ['sos', 'lapse'].includes(params.mode) ? params.mode : 'coach';
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [aiOff, setAiOff] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const endRef = useRef(null);
  const sentInitial = useRef(false);

  const scrollToEnd = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);

  useEffect(() => {
    let active = true;
    recoveryApi
      .getCoachHistory(lang)
      .then((response) => {
        if (!active) return;
        setMessages((current) => [...response.data.messages, ...current.filter((message) => message.id.startsWith('local-'))]);
        scrollToEnd();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lang]);

  useEffect(() => () => synth?.cancel(), []);

  const send = async (text = draft) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setDraft('');
    setMessages((current) => [...current, localMessage('user', trimmed, mode)]);
    setThinking(true);
    scrollToEnd();
    try {
      const response = await recoveryApi.askCoach(trimmed, mode, lang);
      const reply = response.data;
      setMessages((current) => [...current, localMessage('coach', reply.reply, mode, { risk: reply.risk, suggestedTool: reply.suggestedTool, crisis: reply.crisis })]);
    } catch (error) {
      if (error?.response?.data?.code === 'AI_DISABLED') {
        setAiOff(true);
      } else {
        // Never a bare error in a hard moment: a calm, curated message with next steps.
        setMessages((current) => [...current, localMessage('coach', s.coach.errorReply, mode, { suggestedTool: mode === 'sos' ? 'breathing' : 'none' })]);
      }
    } finally {
      setThinking(false);
      scrollToEnd();
    }
  };

  // Opened with a prefilled message (e.g. "Talk it through" after a check-in).
  useEffect(() => {
    if (params.message && !sentInitial.current) {
      sentInitial.current = true;
      send(params.message);
    }
  }, [params.message]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSpeech = (message) => {
    if (!synth) return;
    synth.cancel();
    if (speakingId === message.id) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(message.id);
    synth.speak(utterance);
  };

  const runTool = (tool) => {
    if (tool === 'help') navigation.navigate('RecoveryHelp');
    else if (tool !== 'none') navigation.navigate('RecoverySos', { tool });
  };

  const clear = async () => {
    if (!window.confirm(`${s.coach.clear}\n\n${s.coach.clearConfirm}`)) return;
    try {
      await recoveryApi.clearCoachHistory();
      setMessages([]);
    } catch (_) {
      window.alert(s.common.saveError);
    }
  };

  const latestCrisis = [...messages].reverse().find((message) => message.role === 'coach')?.crisis || null;
  const subtitle = mode === 'sos' ? s.coach.sosSubtitle : mode === 'lapse' ? s.coach.lapseSubtitle : s.coach.subtitle;
  const canSend = !!draft.trim() && !thinking && !aiOff;

  return (
    <RecoveryPage
      title={s.coach.title}
      subtitle={subtitle}
      navigation={navigation}
      right={messages.length ? <HeaderIconButton icon="broom" label={s.coach.clear} onClick={clear} /> : undefined}
      footer={
        <div className="rec-coach-footer">
          <div className="rec-composer">
            <VoiceTextArea value={draft} onChange={setDraft} placeholder={s.coach.placeholder} maxLength={1000} lang={lang} rows={1} disabled={aiOff} onEnter={() => canSend && send()} />
            <button type="button" className="fit-send" aria-label="Send" disabled={!canSend} onClick={() => send()}>
              <Icon name="arrow-up" size={20} />
            </button>
          </div>
          <Muted style={{ fontSize: 11, textAlign: 'center', marginTop: 6 }}>{s.common.aiDisclaimer}</Muted>
        </div>
      }
    >
      {latestCrisis ? <CrisisCard crisis={latestCrisis} contacts={dashboard?.profile?.supportContacts} lang={lang} onMoreHelp={() => navigation.navigate('RecoveryHelp')} /> : null}
      {aiOff ? (
        <>
          <Banner icon="robot-off-outline" tone="warn" text={s.coach.aiOff} />
          <Button label={s.settings.title} icon="cog-outline" onClick={() => navigation.navigate('RecoverySettings')} />
        </>
      ) : null}

      {!messages.length ? (
        <>
          <Card className="rec-hero-card">
            <div className="fit-avatar">
              <Icon name="robot-happy-outline" size={30} />
            </div>
            <h2 className="rec-heading">{s.coach.title}</h2>
            <Muted style={{ textAlign: 'center', marginTop: 4 }}>{s.coach.intro}</Muted>
          </Card>
          <SectionHeader title={s.coach.tryAsking} />
          <div className="rec-suggestions">
            {s.coach.suggestions.map((suggestion) => (
              <Chip key={suggestion} label={suggestion} onClick={() => send(suggestion)} />
            ))}
          </div>
        </>
      ) : null}

      {messages.map((message) => {
        const mine = message.role === 'user';
        return (
          <div key={message.id} className={`fit-bubble-row ${mine ? 'is-user' : 'is-coach'}`} style={{ alignItems: 'flex-start' }}>
            {!mine ? (
              <div className="fit-mini-avatar" style={{ marginTop: 4 }}>
                <Icon name="robot-happy-outline" size={16} />
              </div>
            ) : null}
            <div style={{ minWidth: 0 }}>
              <div className={`fit-bubble ${mine ? 'is-user' : 'is-coach'}${!mine && message.risk === 'crisis' ? ' is-crisis' : ''}`}>{message.text}</div>
              {!mine ? (
                <div className="rec-bubble-actions">
                  {synth ? (
                    <button type="button" className="rec-speak" onClick={() => toggleSpeech(message)}>
                      <Icon name={speakingId === message.id ? 'stop-circle-outline' : 'volume-high'} size={16} />
                      {speakingId === message.id ? s.coach.stopReading : s.coach.readAloud}
                    </button>
                  ) : null}
                  {message.suggestedTool && message.suggestedTool !== 'none' && TOOL_BUTTON_ICONS[message.suggestedTool] ? (
                    <button type="button" className={`rec-tool-btn${message.suggestedTool === 'help' ? ' is-help' : ''}`} onClick={() => runTool(message.suggestedTool)}>
                      <Icon name={TOOL_BUTTON_ICONS[message.suggestedTool]} size={16} />
                      {s.coach.toolButtons[message.suggestedTool]}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {thinking ? (
        <div className="fit-bubble-row is-coach">
          <div className="fit-mini-avatar">
            <Icon name="robot-happy-outline" size={16} />
          </div>
          <div className="fit-bubble is-coach rec-typing" role="status">
            <Spinner />
            {s.coach.thinking}
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </RecoveryPage>
  );
};

export default RecoveryCoach;

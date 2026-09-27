import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fitnessApi } from './fitnessApi';
import { fitPath } from './paths';
import { Button, Card, Chip, FIT, FitnessPage, HeaderIconButton, Icon, Muted, SectionHeader, Spinner, errorMessage, fmt } from './ui';

const SUGGESTIONS = [
  'What should I eat for dinner to hit my protein?',
  'Build me a 3-day beginner workout plan',
  'How can I stop late-night snacking?',
  'Am I on track for my goal this week?',
  'Tips to drink more water',
  'How do I break a weight-loss plateau?',
];

export const FitnessCoach = () => {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, thinking]);

  const ask = async (text = question) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const history = turns;
    setTurns([...history, { role: 'user', text: trimmed }]);
    setQuestion('');
    setThinking(true);
    try {
      const response = await fitnessApi.askCoach(trimmed, history);
      setTurns((old) => [...old, { role: 'coach', text: response.data.reply || 'I could not generate guidance right now.' }]);
    } catch (error) {
      setTurns((old) => [...old, { role: 'coach', text: `⚠️ ${errorMessage(error, 'Coach is unavailable. Please try again shortly.')}` }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <FitnessPage
      title="AI coach"
      subtitle="Knows your targets and today's logs"
      right={turns.length ? <HeaderIconButton icon="broom" label="Clear conversation" onClick={() => setTurns([])} /> : undefined}
      footer={
        <form className="fit-composer" onSubmit={(event) => { event.preventDefault(); ask(); }}>
          <textarea
            rows={1}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(); } }}
            placeholder="Ask about food, training, sleep..."
            maxLength={500}
            aria-label="Message the coach"
          />
          <button type="submit" className="fit-send" aria-label="Send" disabled={!question.trim() || thinking}><Icon name="arrow-up" size={20} /></button>
        </form>
      }
    >
      {!turns.length ? (
        <>
          <Card style={{ textAlign: 'center', padding: '22px 16px' }}>
            <div className="fit-avatar"><Icon name="robot-happy-outline" size={30} /></div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Your personal coach</div>
            <Muted style={{ marginTop: 4 }}>Get answers grounded in your calorie and macro targets, today&apos;s meals, workouts, water, steps and sleep.</Muted>
          </Card>
          <SectionHeader title="Try asking" />
          <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
            {SUGGESTIONS.map((suggestion) => <Chip key={suggestion} label={suggestion} onClick={() => ask(suggestion)} />)}
          </div>
        </>
      ) : null}

      <div aria-live="polite">
        {turns.map((turn, index) => (
          <div key={index} className={`fit-bubble-row is-${turn.role}`}>
            {turn.role === 'coach' ? <span className="fit-mini-avatar"><Icon name="robot-happy-outline" size={16} /></span> : null}
            <div className={`fit-bubble is-${turn.role}`}>{turn.text}</div>
          </div>
        ))}
        {thinking ? (
          <div className="fit-bubble-row is-coach">
            <span className="fit-mini-avatar"><Icon name="robot-happy-outline" size={16} /></span>
            <div className="fit-bubble is-coach" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fit-text-2)' }}><Spinner /> Thinking...</div>
          </div>
        ) : null}
      </div>
      <Muted className="fit-center" style={{ fontSize: 11, marginTop: 12 }}>General wellness guidance, not medical advice.</Muted>
      <div ref={endRef} />
    </FitnessPage>
  );
};

export const FitnessRecommendations = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await fitnessApi.getRecommendations(Date.now());
      setData(response.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load recommendations'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const remaining = data?.remaining || {};
  return (
    <FitnessPage title="Meal ideas" subtitle="Picked to fit what you have left today" right={<HeaderIconButton icon="refresh" label="New ideas" onClick={load} />}>
      {data ? (
        <Card>
          <div className="fit-big-label">Remaining today</div>
          <div style={{ fontSize: 30, fontWeight: 800, margin: '4px 0' }}>{fmt(remaining.calories)} <span className="fit-muted" style={{ fontSize: 14 }}>kcal</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {[{ label: 'Protein', value: remaining.proteinG, color: FIT.protein }, { label: 'Carbs', value: remaining.carbsG, color: FIT.carbs }, { label: 'Fat', value: remaining.fatG, color: FIT.fat }].map((item) => (
              <div key={item.label} style={{ flex: 1, textAlign: 'center', display: 'grid', gap: 2, justifyItems: 'center' }}>
                <span className="fit-swatch" style={{ background: item.color }} />
                <strong>{fmt(item.value)}g</strong>
                <span className="fit-muted" style={{ fontSize: 12 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {error ? <Card><Muted style={{ color: 'var(--fit-error)' }}>{error}</Muted><Button label="Try again" onClick={load} /></Card> : null}
      {loading ? <div className="fit-empty"><Spinner large /><Muted style={{ marginTop: 10 }}>Finding meals that fit your targets...</Muted></div> : null}

      {!loading && data ? (
        <>
          <Muted style={{ fontSize: 12, marginBottom: 8 }}>{data.source === 'gemini' ? 'Personalised by AI' : 'Curated suggestions'} · refresh for new ideas</Muted>
          {(data.recommendations || []).map((item, index) => (
            <Card key={`${item.name}-${index}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 2 }}>
                <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{item.name}</div>
                <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(item.calories)} kcal</div>
              </div>
              <div className="fit-item-sub" style={{ marginBottom: 8 }}>
                {String(item.mealType || 'snack').replace(/^./, (letter) => letter.toUpperCase())} · P {item.proteinG}g · C {item.carbsG}g · F {item.fatG}g
              </div>
              <Muted style={{ fontSize: 13 }}>{item.why}</Muted>
              <Button
                label="Log this meal"
                icon="plus"
                onClick={() => navigate(fitPath('meal'), { state: { analysis: { name: item.name, calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG, fiberG: 0 }, mealType: item.mealType } })}
              />
            </Card>
          ))}
          {(data.healthNotes || []).length ? (
            <>
              <SectionHeader title="Good to know" />
              <Card>
                {data.healthNotes.map((note, index) => (
                  <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <Icon name="information-outline" size={16} color="var(--fit-text-3)" style={{ flex: 'none', marginTop: 2 }} />
                    <Muted style={{ flex: 1, fontSize: 13 }}>{note}</Muted>
                  </div>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </FitnessPage>
  );
};

import React from 'react';
import { OFFLINE_HELPLINES } from './content';
import { useCachedDashboard, useRecoveryContent } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import { Button, Card, Icon, InfoCard, Muted, REC, RecoveryPage, SectionHeader, callPhone, openLink, sendSms } from './ui';

// Web port of expo-connect-app/src/screens/recovery/Help.tsx.
// Works offline: bundled helplines are shown until the server copy is cached.
const RecoveryHelp = () => {
  const navigation = useRecoveryNavigation();
  const { lang, s, f } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const dashboard = useCachedDashboard();
  const helplines = content?.helplines?.length ? content.helplines : OFFLINE_HELPLINES[lang];
  const contacts = (dashboard?.profile?.supportContacts || []).filter((contact) => contact.phone);
  const primary = dashboard?.substances?.find((item) => item.primary) || dashboard?.substances?.[0];
  const talk = helplines.filter((line) => line.key !== 'emergency' && line.kind !== 'treatment');
  const treatment = helplines.filter((line) => line.kind === 'treatment');

  const renderLine = (line) => (
    <Card key={line.key}>
      <div className="rec-row-head" style={{ marginBottom: 0 }}>
        <Icon name={line.kind === 'treatment' ? 'hospital-building' : line.kind === 'youth' ? 'human-child' : 'phone-in-talk-outline'} size={22} color="var(--fit-primary)" />
        <div style={{ flex: 1 }}>
          <div className="rec-line-name" style={{ fontSize: 16, fontWeight: 800 }}>{line.name}</div>
          {line.display || line.hours ? <div className="rec-line-meta" style={{ fontSize: 13 }}>{[line.display, line.hours].filter(Boolean).join(' · ')}</div> : null}
        </div>
      </div>
      <Muted style={{ fontSize: 13, marginTop: 6 }}>{line.description}</Muted>
      <div className="rec-row">
        {line.phone ? <Button label={s.help.call} icon="phone" variant="primary" onClick={() => callPhone(line.phone)} /> : null}
        {line.url ? <Button label={s.help.website} icon="open-in-new" onClick={() => openLink(line.url)} /> : null}
      </div>
    </Card>
  );

  return (
    <RecoveryPage title={s.help.title} subtitle={s.help.subtitle} navigation={navigation} showSos={false}>
      <div className="rec-emergency">
        <div className="rec-row-head" style={{ marginBottom: 0 }}>
          <Icon name="alarm-light-outline" size={24} color={REC.sos} />
          <h2 className="rec-emergency-title">{s.help.emergencyTitle}</h2>
        </div>
        <p className="rec-body">{s.help.emergencyBody}</p>
        <a className="rec-call999" href="tel:999">
          <Icon name="phone" size={20} color="#ffffff" />
          {s.crisis.call999}
        </a>
      </div>

      <SectionHeader title={s.help.myPeople} />
      {contacts.length ? (
        contacts.map((contact) => (
          <Card key={`${contact.name}-${contact.phone}`}>
            <div className="rec-row-head" style={{ marginBottom: 0 }}>
              <Icon name="account-heart-outline" size={22} color="var(--fit-primary)" />
              <div style={{ flex: 1 }}>
                <div className="rec-line-name" style={{ fontSize: 16, fontWeight: 800 }}>{contact.name || contact.phone}</div>
                <div className="rec-line-meta" style={{ fontSize: 13 }}>{[contact.relation, contact.phone].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div className="rec-row">
              <Button label={s.help.call} icon="phone" variant="primary" onClick={() => callPhone(contact.phone)} />
              <Button label={s.help.message} icon="message-text-outline" onClick={() => sendSms(contact.phone, s.sos.smsText)} />
            </div>
          </Card>
        ))
      ) : dashboard?.profile ? (
        <Button label={s.help.addPerson} icon="account-plus-outline" onClick={() => navigation.navigate('RecoverySettings')} />
      ) : null}

      <SectionHeader title={s.help.talkTitle} />
      {talk.map(renderLine)}

      <InfoCard icon="message-question-outline" title={s.help.scriptTitle}>
        <p className="rec-quote" style={{ marginTop: 0 }}>{f(s.help.script, { substance: primary?.name || (lang === 'bn' ? 'নেশা' : 'drugs') })}</p>
      </InfoCard>

      {treatment.length ? <SectionHeader title={s.help.treatmentTitle} /> : null}
      {treatment.map(renderLine)}

      <InfoCard icon="medical-bag" title={s.help.overdoseTitle} tone={REC.sos}>
        {s.help.overdoseSteps.map((step, index) => (
          <div key={step} className="rec-step">
            <span className="rec-step-number">{index + 1}.</span>
            <span style={{ flex: 1 }}>{step}</span>
          </div>
        ))}
      </InfoCard>

      <Muted style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>{s.help.note}</Muted>
    </RecoveryPage>
  );
};

export default RecoveryHelp;

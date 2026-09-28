import React, { useEffect, useState } from 'react';
import { recoveryApi } from './recoveryApi';
import { ContactsEditor } from './Onboarding';
import { cleanPhone } from './helpers';
import { useRecoveryDashboard } from './hooks';
import { REMINDER_PATHS, useRecoveryNavigation } from './paths';
import { clearRecoveryReminders, getCheckinReminderTime, setCheckinReminderTime, syncRecoveryReminders } from './reminders';
import { setRecoveryLanguage, useRecoveryI18n } from './i18n';
import { Banner, Button, Card, Muted, RecoveryPage, SectionHeader, Segmented, Toggle, errorMessage } from './ui';

// Web port of expo-connect-app/src/screens/recovery/Settings.tsx.
const RecoverySettings = () => {
  const navigation = useRecoveryNavigation();
  const { lang, override, s, f } = useRecoveryI18n();
  const { data, setData } = useRecoveryDashboard(lang);
  const profile = data?.profile;
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [message, setMessage] = useState('');
  const [checkinTime, setCheckinTime] = useState(() => getCheckinReminderTime());

  useEffect(() => {
    if (!profile) return;
    setSettings((old) => old || profile.settings);
    setContacts((old) => old || (profile.supportContacts.length ? profile.supportContacts : [{ name: '', phone: '', relation: '' }]));
  }, [profile]);

  const toggleCheckinReminder = async (on) => {
    const value = on ? '21:00' : 'off';
    setCheckinTime(value);
    await setCheckinReminderTime(value);
    syncRecoveryReminders(data, lang, REMINDER_PATHS);
  };

  const toggle = async (key, value) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      await recoveryApi.saveProfile({ settings: next }, lang);
      setMessage(s.settings.saved);
      // Discreet wording and risky-time nudges change what is scheduled.
      if (data?.profile) syncRecoveryReminders({ ...data, profile: { ...data.profile, settings: next } }, lang, REMINDER_PATHS);
    } catch (saveError) {
      setSettings(settings);
      setMessage(errorMessage(saveError, s.common.saveError));
    }
  };

  const changeLanguage = (choice) => {
    setRecoveryLanguage(choice);
    // The server uses this for AI replies when the app sends no language.
    if (profile) recoveryApi.saveProfile({ language: choice }, choice === 'auto' ? lang : choice).catch(() => {});
  };

  const savePeople = async () => {
    const cleaned = (contacts || []).map((contact) => ({ ...contact, phone: cleanPhone(contact.phone) })).filter((contact) => contact.name.trim() || contact.phone.trim());
    try {
      await recoveryApi.saveProfile({ supportContacts: cleaned }, lang);
      setMessage(s.settings.saved);
    } catch (saveError) {
      setMessage(errorMessage(saveError, s.common.saveError));
    }
  };

  const exportData = async () => {
    try {
      const response = await recoveryApi.exportData();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `connect-recovery-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setMessage(errorMessage(exportError, s.common.saveError));
    }
  };

  const deleteAll = async () => {
    if (!window.confirm(`${s.home.deleteConfirmTitle}\n\n${s.home.deleteConfirmBody}`)) return;
    try {
      await recoveryApi.reset();
      recoveryApi.clearCache();
      clearRecoveryReminders();
      setData({ profile: null });
      navigation.replace('RecoveryHome');
    } catch (resetError) {
      setMessage(errorMessage(resetError, s.common.saveError));
    }
  };

  const row = (key, title, body) => (
    <div className="rec-switch-row">
      <div style={{ flex: 1 }}>
        <div className="rec-row-title">{title}</div>
        <Muted style={{ fontSize: 13, marginTop: 2 }}>{body}</Muted>
      </div>
      <Toggle label={title} value={!!settings?.[key]} disabled={!settings} onChange={(value) => toggle(key, value)} />
    </div>
  );

  return (
    <RecoveryPage title={s.settings.title} navigation={navigation}>
      {message ? <Banner icon={message === s.settings.saved ? 'check' : 'alert-circle-outline'} tone={message === s.settings.saved ? 'good' : 'warn'} text={message} /> : null}

      <SectionHeader title={s.settings.languageTitle} />
      <Segmented
        options={[
          { label: s.settings.langAuto, value: 'auto' },
          { label: 'English', value: 'en' },
          { label: 'বাংলা', value: 'bn' },
        ]}
        value={override}
        onChange={changeLanguage}
      />

      {profile ? (
        <>
          <Card>
            {row('aiEnabled', s.settings.aiTitle, s.settings.aiBody)}
            {row('discreet', s.settings.discreetTitle, s.settings.discreetBody)}
            {row('riskNudges', s.settings.nudgesTitle, s.settings.nudgesBody)}
            <div className="rec-switch-row">
              <div style={{ flex: 1 }}>
                <div className="rec-row-title">{s.settings.checkinReminderTitle}</div>
                <Muted style={{ fontSize: 13, marginTop: 2 }}>{f(s.settings.checkinReminderBody, { time: checkinTime && checkinTime !== 'off' ? checkinTime : '21:00' })}</Muted>
              </div>
              <Toggle label={s.settings.checkinReminderTitle} value={checkinTime !== 'off'} onChange={toggleCheckinReminder} />
            </div>
          </Card>

          <SectionHeader title={s.settings.peopleTitle} />
          <Muted style={{ fontSize: 13, marginBottom: 10, marginTop: -4 }}>{s.settings.peopleHint}</Muted>
          {contacts ? <ContactsEditor contacts={contacts} onChange={setContacts} /> : null}
          <Button label={s.settings.savePeople} loadingLabel={s.common.saving} icon="content-save-outline" onClick={savePeople} />

          <SectionHeader title={s.settings.detailsTitle} />
          <Button label={s.settings.editDetails} icon="pencil-outline" onClick={() => navigation.navigate('RecoveryOnboarding', { edit: true })} />

          <SectionHeader title={s.settings.dataTitle} />
          <Muted style={{ fontSize: 13, marginBottom: 10, marginTop: -4 }}>{s.settings.exportHint}</Muted>
          <Button label={s.settings.exportData} loadingLabel={s.common.loading} icon="export-variant" onClick={exportData} />
          <Button label={s.home.deleteAll} icon="delete-outline" variant="danger" onClick={deleteAll} />
        </>
      ) : null}
    </RecoveryPage>
  );
};

export default RecoverySettings;

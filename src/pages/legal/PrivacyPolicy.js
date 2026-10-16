import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { APP_NAME, CONTACT_EMAIL, LAST_UPDATED } from "./legalConfig";
import "./Legal.css";

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = `Privacy Policy | ${APP_NAME}`;
  }, []);

  return (
    <div className="legal-page">
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

      <p>
        This Privacy Policy explains how {APP_NAME} ("we", "us") collects, uses and
        shares information when you use our website and mobile apps (the "Service").
        By using the Service you agree to this policy.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> name, username, email, phone number, password (stored hashed) and profile photo.</li>
        <li><strong>Content you create:</strong> posts, comments, messages, photos, videos, voice notes, files and other content you upload or share.</li>
        <li><strong>Calls:</strong> audio and video are transmitted in real time to connect calls; we do not record calls unless you are told otherwise.</li>
        <li><strong>Camera and face data:</strong> if you use face login or camera features, images are processed to provide that feature. Face login data is used only for authentication.</li>
        <li><strong>Location:</strong> approximate or precise location when you grant permission, for maps and location-based features.</li>
        <li><strong>Health and fitness:</strong> information you enter in health, fitness, habit and focus tools.</li>
        <li><strong>Payments and wallet:</strong> transaction history and balances. Card details are handled by our payment providers and are not stored on our servers.</li>
        <li><strong>AI features:</strong> prompts, voice input and files you send to AI assistants.</li>
        <li><strong>Device and usage data:</strong> IP address, device type, browser, app version, push-notification tokens, log data and cookies or local storage.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>To provide, operate and improve the Service, including messaging, calls, feeds, games and marketplace.</li>
        <li>To authenticate you and keep your account secure.</li>
        <li>To send notifications, service messages and password-reset emails.</li>
        <li>To personalise content and recommendations.</li>
        <li>To detect, prevent and respond to fraud, abuse and violations of our Terms.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>3. How we share information</h2>
      <p>We do not sell your personal information. We share it only:</p>
      <ul>
        <li>With other users, according to your settings and what you choose to share.</li>
        <li>With service providers that help us run the Service (hosting, storage, real-time calling, push notifications, payments, AI processing, analytics), under confidentiality obligations.</li>
        <li>When required by law, or to protect the rights, safety and property of our users or others.</li>
        <li>In connection with a merger, acquisition or sale of assets, with notice to you.</li>
      </ul>

      <h2>4. Data retention</h2>
      <p>
        We keep your information for as long as your account is active or as needed to
        provide the Service. When you delete your account, we delete or anonymise your
        personal information within a reasonable period, except where we must keep it
        for legal, security or dispute-resolution reasons.
      </p>

      <h2>5. Your rights and choices</h2>
      <ul>
        <li>Access, update or correct your profile information in the app.</li>
        <li>Request a copy or deletion of your data by contacting us.</li>
        <li>Withdraw device permissions (camera, microphone, location, notifications) in your device settings.</li>
        <li>Depending on where you live, you may have additional rights under laws such as GDPR or CCPA.</li>
      </ul>

      <h2>6. Security</h2>
      <p>
        We use reasonable technical and organisational measures to protect your
        information, including encryption in transit. No method of transmission or
        storage is completely secure, so we cannot guarantee absolute security.
      </p>

      <h2>7. Children</h2>
      <p>
        The Service is not intended for children under 13 (or the minimum age in your
        country). We do not knowingly collect information from them. If you believe a
        child has given us information, contact us and we will delete it.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Your information may be processed in countries other than your own. We take
        steps to ensure it receives an adequate level of protection.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. We will post the new version here
        and update the date above. Significant changes will be notified in the app.
      </p>

      <h2>10. Contact us</h2>
      <p>
        Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <div className="legal-nav">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/">Home</Link>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

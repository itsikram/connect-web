import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { APP_NAME, CONTACT_EMAIL, LAST_UPDATED } from "./legalConfig";
import "./Legal.css";

const TermsOfService = () => {
  useEffect(() => {
    document.title = `Terms of Service | ${APP_NAME}`;
  }, []);

  return (
    <div className="legal-page">
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

      <p>
        These Terms of Service ("Terms") govern your use of {APP_NAME}'s website and
        mobile apps (the "Service"). By creating an account or using the Service, you
        agree to these Terms and to our <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 13 years old (or the minimum age in your country) to use
        the Service. If you are under the age of majority, you need permission from a
        parent or guardian.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Provide accurate information and keep it up to date.</li>
        <li>Keep your password secure; you are responsible for activity on your account.</li>
        <li>Tell us promptly about any unauthorised use.</li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You own the content you post. By posting it, you grant us a worldwide,
        non-exclusive, royalty-free licence to host, store, display and distribute it
        as needed to operate and improve the Service. This licence ends when you delete
        the content, except where it has been shared with others who have not deleted it.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Break any law or infringe anyone's rights, including copyright.</li>
        <li>Post content that is hateful, harassing, sexually exploitative, violent or misleading.</li>
        <li>Impersonate others or misrepresent your identity.</li>
        <li>Send spam, scams or malware.</li>
        <li>Access, scrape or disrupt the Service by automated or unauthorised means.</li>
        <li>Download or redistribute third-party content you do not have rights to.</li>
      </ul>
      <p>We may remove content or suspend accounts that violate these Terms.</p>

      <h2>5. Payments, wallet and marketplace</h2>
      <p>
        Some features may involve payments, a wallet balance or transactions between
        users. Prices and fees are shown before you pay. Transactions between users are
        between those users; we are not a party to them and are not responsible for
        goods or services exchanged. Refunds are handled according to the policy shown
        at purchase or as required by law.
      </p>

      <h2>6. AI features</h2>
      <p>
        AI-generated output may be inaccurate or incomplete. Do not rely on it for
        medical, legal, financial or other professional advice. Health and fitness
        features are for general information only.
      </p>

      <h2>7. Third-party services</h2>
      <p>
        The Service may link to or integrate third-party services. Their own terms and
        policies apply, and we are not responsible for them.
      </p>

      <h2>8. Our intellectual property</h2>
      <p>
        The Service, including its software, design and branding, belongs to us or our
        licensors. You may not copy, modify or reverse-engineer it except as permitted by law.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may
        suspend or terminate your access if you violate these Terms or if required by law.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of any
        kind, to the extent permitted by law. We do not guarantee that it will be
        uninterrupted, secure or error-free.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any indirect,
        incidental, special, consequential or punitive damages, or for loss of data,
        profits or goodwill, arising from your use of the Service.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms. We will post the new version here and update the
        date above. Continuing to use the Service after changes means you accept them.
      </p>

      <h2>13. Contact us</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <div className="legal-nav">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/">Home</Link>
      </div>
    </div>
  );
};

export default TermsOfService;

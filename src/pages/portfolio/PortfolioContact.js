import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { usePortfolio } from '../../contexts/PortfolioContext';

function getServerBase() {
  const raw = process.env.REACT_APP_SERVER_ADDR || '';
  return String(raw).trim().replace(/\/+$/, '') || 'https://connect-server-7h7d.onrender.com';
}

const PortfolioContact = () => {
  const { data, loading } = usePortfolio();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const profile = data?.profile || {};
  const contactPage = data?.contactPage || {};
  const social = data?.social || {};

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await axios.post(
        `${getServerBase()}/api/portfolio/contact`,
        {
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
          subject: `${contactPage.mailSubjectPrefix || 'New message from Connect Portfolio'} — ${form.name.trim()}`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200 && response.data?.success !== false) {
        toast.success('Email sent successfully. Thank you for reaching out.', {
          position: 'top-right',
          autoClose: 5000,
        });
        setForm({ name: '', email: '', message: '' });
      } else {
        throw new Error(response.data?.message || 'Failed to send');
      }
    } catch (err) {
      console.error('Error sending mail:', err.response?.data || err.message);
      toast.error(
        err.response?.data?.message || 'Failed to send email. Please try again or email me directly.',
        {
          position: 'top-right',
          autoClose: 5000,
        }
      );
    } finally {
      setSending(false);
    }
  };

  if (loading && !data) {
    return <div className="portfolio-section color-tc">Loading…</div>;
  }

  const phoneHref = profile.phone
    ? `tel:${String(profile.phone).startsWith('+') ? profile.phone : `+88${profile.phone}`}`
    : undefined;

  return (
    <section id="contact" className="portfolio-section">
      <h1 className="section-title">{contactPage.title || 'Contact'}</h1>
      {contactPage.subtitle ? <p className="section-subtitle">{contactPage.subtitle}</p> : null}

      <div className="contact-layout">
        <div className="about-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="about-card">
            <h3 className="color-wh">Contact Information</h3>
            <dl className="info-list">
              {profile.email ? (
                <div className="info-row">
                  <dt className="info-label">Email</dt>
                  <dd className="info-value">
                    <a className="contact-detail-link" href={`mailto:${profile.email}`}>
                      {profile.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {profile.phone ? (
                <div className="info-row">
                  <dt className="info-label">Mobile</dt>
                  <dd className="info-value">
                    <a className="contact-detail-link" href={phoneHref}>
                      {profile.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {profile.website ? (
                <div className="info-row">
                  <dt className="info-label">Website</dt>
                  <dd className="info-value">
                    <a
                      className="contact-detail-link"
                      href={`${profile.website.replace(/\/?$/, '/') }portfolio`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {profile.website}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="about-card">
            <h3 className="color-wh">Address</h3>
            {profile.addressLine1 ? <p className="color-tc">{profile.addressLine1}</p> : null}
            {profile.addressLine2 ? <p className="color-tc">{profile.addressLine2}</p> : null}
            <p className="color-tc">
              {[profile.locality, profile.country].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>

        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              rows={5}
              placeholder="Tell me about your project…"
              value={form.message}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>

      <div className="contact-links">
        {social.linkedin ? (
          <a className="btn btn-outline" href={social.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        ) : null}
        {social.github ? (
          <a className="btn btn-outline" href={social.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
        ) : null}
      </div>
    </section>
  );
};

export default PortfolioContact;

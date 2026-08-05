import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import config from '../../config/config.json';

const PortfolioContact = () => {
    const [form, setForm] = useState({ name: '', email: '', message: '' });
    const [sending, setSending] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);

        try {
            const response = await axios.post(
                config?.mailApiUrl,
                {
                    name: form.name,
                    email: form.email,
                    message: form.message,
                    subject: `New message from ${form.name} On Connect Portfolio`,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.status === 200) {
                toast.success('Email sent successfully. Thank you for reaching out.', {
                    position: 'top-right',
                    autoClose: 5000,
                });
                setForm({ name: '', email: '', message: '' });
            }
        } catch (err) {
            console.error('Error sending mail:', err.response?.data || err.message);
            toast.error('Failed to send email. Please try again or email me directly.', {
                position: 'top-right',
                autoClose: 5000,
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <section id='contact' className='portfolio-section'>
            <h1 className='section-title'>Contact Md Ikram</h1>
            <p className='section-subtitle'>
                Hire Md Ikram (Ikramul Islam) for WordPress, MERN, or React Native projects.
                Available for interesting collaborations.
            </p>

            <div className='contact-layout'>
                <div className='about-grid' style={{ gridTemplateColumns: '1fr' }}>
                    <div className='about-card'>
                        <h3 className='color-wh'>Contact Information</h3>
                        <dl className='info-list'>
                            <div className='info-row'>
                                <dt className='info-label'>Email</dt>
                                <dd className='info-value'>
                                    <a className='contact-detail-link' href='mailto:mdikram295@gmail.com'>
                                        mdikram295@gmail.com
                                    </a>
                                </dd>
                            </div>
                            <div className='info-row'>
                                <dt className='info-label'>Mobile</dt>
                                <dd className='info-value'>
                                    <a className='contact-detail-link' href='tel:+8801581400711'>
                                        01581400711
                                    </a>
                                </dd>
                            </div>
                            <div className='info-row'>
                                <dt className='info-label'>Website</dt>
                                <dd className='info-value'>
                                    <a
                                        className='contact-detail-link'
                                        href={`${config?.siteUrl}portfolio`}
                                        target='_blank'
                                        rel='noreferrer'
                                    >
                                        {config?.siteUrl}
                                    </a>
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <div className='about-card'>
                        <h3 className='color-wh'>Address</h3>
                        <p className='color-tc'>Biler Kani, West Dewvoge</p>
                        <p className='color-tc'>Munshiganj, Bangladesh</p>
                    </div>
                </div>

                <form className='contact-form' onSubmit={handleSubmit} noValidate>
                    <div className='form-row'>
                        <div className='form-field'>
                            <label htmlFor='name'>Name</label>
                            <input
                                id='name'
                                name='name'
                                type='text'
                                autoComplete='name'
                                placeholder='Your name'
                                value={form.name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className='form-field'>
                            <label htmlFor='email'>Email</label>
                            <input
                                id='email'
                                name='email'
                                type='email'
                                autoComplete='email'
                                placeholder='you@example.com'
                                value={form.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>
                    <div className='form-field'>
                        <label htmlFor='message'>Message</label>
                        <textarea
                            id='message'
                            name='message'
                            rows={5}
                            placeholder='Tell me about your project…'
                            value={form.message}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button type='submit' className='btn btn-primary' disabled={sending}>
                        {sending ? 'Sending…' : 'Send Message'}
                    </button>
                </form>
            </div>

            <div className='contact-links'>
                <a
                    className='btn btn-outline'
                    href='https://www.linkedin.com/in/ikramul-islam-38a484260/'
                    target='_blank'
                    rel='noreferrer'
                >
                    LinkedIn
                </a>
                <a
                    className='btn btn-outline'
                    href='https://github.com/itsikram'
                    target='_blank'
                    rel='noreferrer'
                >
                    GitHub
                </a>
            </div>
        </section>
    );
};

export default PortfolioContact;
